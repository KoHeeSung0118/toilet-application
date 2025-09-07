// components/map/MapView.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import { getPusher } from '@/lib/pusher-client';
import type { Channel } from 'pusher-js';

const Header = dynamic(() => import('@/components/common/Header'), { ssr: false });

const FILTERS = [
  '화장실 칸 많음',
  '화장실 칸 적음',
  '장애인 화장실',
  '성별 분리',
  '비데 설치 되어있음',
  '휴지 많음',
  '물 잘나옴',
  '냄새 좋음',
] as const;

const SEARCH_DISTANCE_M = 500;
const SEARCH_COOLDOWN_MS = 4000;

interface KakaoPlace { id: string; place_name: string; x: string; y: string; }
interface ToiletDbData { overallRating?: number; reviews?: { user: string; comment: string }[]; keywords?: string[]; }
interface EnrichedToilet extends KakaoPlace { overallRating: number; reviews: { user: string; comment: string }[]; keywords: string[]; }
interface Toilet extends EnrichedToilet { lat: number; lng: number; }

type ActiveSignal = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  createdAt: string;
  expiresAt: string;
};

type MapWithGetCenter = kakao.maps.Map & { getCenter(): kakao.maps.LatLng };
type MapWithPanTo = kakao.maps.Map & { panTo(pos: kakao.maps.LatLng): void };
type LatLngGettable = kakao.maps.LatLng & { getLat(): number; getLng(): number };
type MarkerWithSetPosition = kakao.maps.Marker & { setPosition(pos: kakao.maps.LatLng): void };
type MarkerWithSetImage = kakao.maps.Marker & { setImage(img: kakao.maps.MarkerImage): void };

const toNum = (v?: string | number | null): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function dist(a: LatLngGettable, b: LatLngGettable): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.getLat() - a.getLat());
  const dLng = toRad(b.getLng() - a.getLng());
  const la1 = toRad(a.getLat());
  const la2 = toRad(b.getLat());
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function ensureKakaoReady(): boolean {
  if (typeof window === 'undefined') return false;
  const m = window.kakao?.maps;
  return Boolean(
    m &&
      m.Map &&
      m.LatLng &&
      m.Marker &&
      m.CustomOverlay &&
      m.services &&
      m.services.Places &&
      m.services.Geocoder
  );
}

async function assetExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function setMarkerImageIfExists(
  marker: kakao.maps.Marker,
  path: string,
  size: kakao.maps.Size
): Promise<void> {
  if (await assetExists(path)) {
    const img = new window.kakao.maps.MarkerImage(path, size);
    (marker as MarkerWithSetImage).setImage(img);
  }
}

export default function MapView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersByIdRef = useRef<Map<string, kakao.maps.Marker>>(new Map());
  const currentPosRef = useRef<kakao.maps.LatLng | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);

  const lastSearchCenterRef = useRef<LatLngGettable | null>(null);
  const lastSearchAtRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  const overlayMapRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<Toilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

  const queryKeyword = searchParams?.get('query') ?? '';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ★ 추가: 이미 SDK가 로드된 상태(재방문)에서도 kakaoReady를 보장
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).kakao?.maps?.load) {
      // 이미 스크립트가 존재하면 load 콜백이 즉시/성공 시점에 호출됨
      (window as any).kakao.maps.load(() => setKakaoReady(true));
    }
  }, []);

  const makePulseContent = (): HTMLDivElement => {
    const wrap = document.createElement('div');
    wrap.style.pointerEvents = 'none';
    wrap.className = 'pulse-wrapper';
    const inner = document.createElement('div');
    inner.className = 'pulse-signal';
    wrap.appendChild(inner);
    return wrap;
  };

  const addOverlay = useCallback((sig: ActiveSignal): void => {
    if (!mapRef.current) return;
    const pos = new window.kakao.maps.LatLng(sig.lat, sig.lng);
    const ov = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: makePulseContent(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1,
      clickable: false,
    });
    ov.setMap(mapRef.current);
    overlayMapRef.current.set(sig._id, ov);
  }, []);

  const removeOverlay = useCallback((signalId: string): void => {
    const ov = overlayMapRef.current.get(signalId);
    if (ov) {
      ov.setMap(null);
      overlayMapRef.current.delete(signalId);
    }
  }, []);

  const reconcileOverlays = useCallback((activeItems: ActiveSignal[]): void => {
    const nextIds = new Set(activeItems.map(s => s._id));
    activeItems.forEach(s => addOverlay(s));
    Array.from(overlayMapRef.current.keys()).forEach(id => {
      if (!nextIds.has(id)) removeOverlay(id);
    });
  }, [addOverlay, removeOverlay]);

  const fetchActiveSignals = useCallback(async (toiletIds: string[]): Promise<void> => {
    if (!toiletIds.length) return;
    try {
      const idsParam = encodeURIComponent(toiletIds.join(','));
      const resp = await fetch(`/api/signal/active?toiletIds=${idsParam}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { items?: ActiveSignal[] };
      reconcileOverlays(data.items ?? []);
    } catch {
      /* ignore */
    }
  }, [reconcileOverlays]);

  const drawMarkers = useCallback((toilets: Toilet[]): void => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const nextIds = new Set<string>(toilets.map(t => t.id));

    for (const [id, m] of markersByIdRef.current.entries()) {
      if (!nextIds.has(id)) {
        m.setMap(null);
        markersByIdRef.current.delete(id);
      }
    }

    toilets.forEach(place => {
      const pos = new window.kakao.maps.LatLng(place.lat, place.lng);
      let marker = markersByIdRef.current.get(place.id);
      if (!marker) {
        marker = new window.kakao.maps.Marker({ map, position: pos, zIndex: 10 });
        markersByIdRef.current.set(place.id, marker);

        void setMarkerImageIfExists(marker, '/marker/toilet-icon.png', new window.kakao.maps.Size(40, 40));

        const html = `
          <div class="custom-overlay">
            <button class="custom-close-btn">&times;</button>
            <div class="info-title">${place.place_name}</div>
            <div class="info-rating">★ ${place.overallRating.toFixed(1)}</div>
            <div class="info-keywords">${place.keywords.map(k => `<span>#${k}</span>`).join('')}</div>
            <a class="info-link" href="/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}">자세히 보기</a>
          </div>`;
        const content = document.createElement('div');
        content.innerHTML = html;
        const overlay = new window.kakao.maps.CustomOverlay({
          content,
          position: pos,
          xAnchor: 0.5,
          yAnchor: 1.1,
          zIndex: 9999,
          clickable: false,
        });

        window.kakao.maps.event.addListener(marker, 'click', () => {
          (map as MapWithPanTo).panTo(pos);
          if (currentOverlayRef.current && currentOverlayRef.current !== overlay) {
            currentOverlayRef.current.setMap(null);
          }
          overlay.setMap(map);
          currentOverlayRef.current = overlay;

          content.querySelector('.custom-close-btn')?.addEventListener('click', () => {
            overlay.setMap(null);
            if (currentOverlayRef.current === overlay) currentOverlayRef.current = null;
          }, { once: true });
        });

        window.kakao.maps.event.addListener(marker, 'dblclick', () => {
          router.push(`/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}`);
        });
      } else {
        (marker as MarkerWithSetPosition).setPosition(pos);
      }
    });

    fetchActiveSignals(toilets.map(t => t.id));
  }, [fetchActiveSignals, pathname, router]);

  const searchToilets = useCallback(async (lat: number, lng: number, shouldCenter = false): Promise<void> => {
    if (!kakaoReady || !ensureKakaoReady() || !mapRef.current) return;

    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== 'OK') return;

        const enriched = await Promise.all(
          (data as KakaoPlace[]).map(async (p) => {
            const res = await fetch(`/api/toilet/${p.id}?place_name=${encodeURIComponent(p.place_name)}`);
            const db = (await res.json()) as ToiletDbData;
            return { ...p, overallRating: db.overallRating ?? 3, reviews: db.reviews ?? [], keywords: db.keywords ?? [] };
          })
        );

        const converted: Toilet[] = enriched
          .map(t => ({ ...t, lat: toNum(t.y) ?? 0, lng: toNum(t.x) ?? 0 }))
          .filter(t => t.lat !== null && t.lng !== null) as Toilet[];

        setToiletList(converted);
        localStorage.setItem('toiletList', JSON.stringify(converted));
        setAllToilets(converted);
        drawMarkers(converted);

        lastSearchCenterRef.current = new window.kakao.maps.LatLng(lat, lng) as LatLngGettable;
        lastSearchAtRef.current = Date.now();

        if (shouldCenter && mapRef.current) {
          (mapRef.current as MapWithPanTo).panTo(new window.kakao.maps.LatLng(lat, lng));
        }
      },
      { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 }
    );
  }, [drawMarkers, setToiletList, kakaoReady]);

  const handleQuerySearch = useCallback((keyword: string): void => {
    if (!keyword || !kakaoReady || !ensureKakaoReady() || !mapRef.current) return;

    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === 'OK' && result[0]) {
        const { y, x } = result[0];
        const coords = new window.kakao.maps.LatLng(+y, +x);
        (mapRef.current as MapWithPanTo).panTo(coords);
        searchToilets(+y, +x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  }, [searchToilets, kakaoReady]);

  // SDK 준비 + 지도 생성 이후에만 쿼리 자동 검색
  useEffect(() => {
    if (kakaoReady && ensureKakaoReady() && mapRef.current && queryKeyword) {
      handleQuerySearch(queryKeyword);
    }
  }, [kakaoReady, queryKeyword, handleQuerySearch]);

  const cleanupRef = useRef<(() => void) | null>(null);

  // kakaoReady 되면 지도 초기화
  useEffect(() => {
    if (!kakaoReady || !ensureKakaoReady() || mapRef.current) return;

    let canceled = false;

    const initMap = (lat: number, lng: number): void => {
      if (canceled) return;
      const center = new window.kakao.maps.LatLng(lat, lng);
      const mapEl = document.getElementById('map');
      if (!mapEl) return;

      mapRef.current = new window.kakao.maps.Map(mapEl, { center, level: 3 });
      currentPosRef.current = center;
      lastSearchCenterRef.current = center as LatLngGettable;
      lastSearchAtRef.current = Date.now();

      // Pusher 구독
      const pusher = getPusher();
      const ch: Channel = pusher.subscribe('toilet-global');

      const reSync = (): void => {
        const ids = Array.from(markersByIdRef.current.keys());
        void fetchActiveSignals(ids);
      };

      ch.bind('signals_changed', reSync);

      const pollId = window.setInterval(reSync, 20000);
      const onFocus = (): void => reSync();
      window.addEventListener('focus', onFocus);

      cleanupRef.current = () => {
        ch.unbind('signals_changed', reSync);
        pusher.unsubscribe('toilet-global');
        window.clearInterval(pollId);
        window.removeEventListener('focus', onFocus);
      };

      requestAnimationFrame(() => searchToilets(lat, lng, false));

      window.kakao.maps.event.addListener(mapRef.current!, 'idle', () => {
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(() => {
          const c = (mapRef.current as MapWithGetCenter).getCenter() as LatLngGettable;
          const last = lastSearchCenterRef.current;
          const movedEnough = !last || dist(last, c) >= SEARCH_DISTANCE_M;
          const coolEnough = Date.now() - lastSearchAtRef.current >= SEARCH_COOLDOWN_MS;

          if (movedEnough && coolEnough) {
            searchToilets(c.getLat(), c.getLng(), false);
          }
        }, 400);
      });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
      ()   => initMap(37.5665, 126.9780),
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
    );

    // ★ 변경: 언마운트 시 실제 정리 로직 실행
    return () => {
      canceled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      currentOverlayRef.current?.setMap?.(null);
      currentOverlayRef.current = null;
      overlayMapRef.current.forEach(o => o.setMap(null));
      overlayMapRef.current.clear();
      markersByIdRef.current.forEach(m => m.setMap(null));
      markersByIdRef.current.clear();
      mapRef.current = null;
    };
  }, [kakaoReady, fetchActiveSignals, searchToilets]);

  useEffect(() => {
    let currentMarker: kakao.maps.Marker | null = null;
    let watcherId: number | null = null;

    const placeOrMove = (lat: number, lng: number): void => {
      if (!mapRef.current) return;
      const latLng = new window.kakao.maps.LatLng(lat, lng);
      currentPosRef.current = latLng;
      if (!currentMarker) {
        currentMarker = new window.kakao.maps.Marker({
          map: mapRef.current,
          position: latLng,
          zIndex: 9999,
        });
        void setMarkerImageIfExists(currentMarker, '/marker/location-icon.png', new window.kakao.maps.Size(36, 36));
      } else {
        (currentMarker as MarkerWithSetPosition).setPosition(latLng);
      }
    };

    if ('geolocation' in navigator) {
      watcherId = navigator.geolocation.watchPosition(
        (pos) => placeOrMove(pos.coords.latitude, pos.coords.longitude),
        () => { /* ignore */ },
        { enableHighAccuracy: false, maximumAge: 20000, timeout: 8000 }
      );
    }

    const fallbackId = window.setTimeout(() => {
      if (!currentMarker && mapRef.current) {
        const c = (mapRef.current as MapWithGetCenter).getCenter();
        const gg = c as LatLngGettable;
        placeOrMove(gg.getLat(), gg.getLng());
      }
    }, 3000);

    return () => {
      if (watcherId !== null) navigator.geolocation.clearWatch(watcherId);
      window.clearTimeout(fallbackId);
      currentMarker?.setMap(null);
    };
  }, []);

  const handleLocateClick = (): void => {
    if (mapRef.current && currentPosRef.current) {
      (mapRef.current as MapWithPanTo).panTo(currentPosRef.current);
    }
  };

  useEffect(() => {
    drawMarkers(
      selectedFilters.length
        ? allToilets.filter((t) => selectedFilters.every((f) => t.keywords.includes(f)))
        : allToilets
    );
  }, [selectedFilters, allToilets, drawMarkers]);

  return (
    <div className="map-wrapper">
      {/* Kakao SDK: autoload=false + services, onLoad에서 maps.load 호출 */}
      <Script
        id="kakao-sdk"
        strategy="afterInteractive"
        src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services"
        onLoad={() => {
          // 최초 로드 시
          window.kakao.maps.load(() => {
            setKakaoReady(true);
          });
        }}
      />

      <Header />
      <div className="top-ui">
        <button
          type="button"
          className="toggle-filter-btn"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? '키워드 숨기기' : '키워드로 찾기'}
        </button>

        {showFilters && (
          <div className="keyword-filter">
            {FILTERS.map((f) => {
              const active = selectedFilters.includes(f);
              return (
                <button
                  type="button"
                  key={f}
                  className={`filter-btn ${active ? 'active' : ''}`}
                  onClick={() =>
                    setSelectedFilters((prev) =>
                      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                    )
                  }
                >
                  #{f}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="map-container">
        <div id="map" />
        <button type="button" className="loc-btn" onClick={handleLocateClick}>
          📍
        </button>
      </div>
    </div>
  );
}
