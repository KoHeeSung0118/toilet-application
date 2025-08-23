'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import io, { Socket } from 'socket.io-client';

const Header = dynamic(() => import('@/components/common/Header'), { ssr: false });

const FILTERS = [
  '화장실 칸 많음', '화장실 칸 적음', '장애인 화장실', '성별 분리',
  '비데 설치 되어있음', '휴지 많음', '물 잘나옴', '냄새 좋음',
] as const;

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
type MarkerWithSetPosition = kakao.maps.Marker & { setPosition(pos: kakao.maps.LatLng): void };
type LatLngWithGet = kakao.maps.LatLng & { getLat(): number; getLng(): number };

const toNum = (v?: string | number | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function MapView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const currentPosRef = useRef<kakao.maps.LatLng | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const overlayMapRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<Toilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const queryKeyword = searchParams?.get('query');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const makePulseContent = () => {
    const wrap = document.createElement('div');
    wrap.style.pointerEvents = 'none';
    wrap.className = 'pulse-wrapper';
    const inner = document.createElement('div');
    inner.className = 'pulse-signal';
    wrap.appendChild(inner);
    return wrap;
  };

  const addOverlay = useCallback((sig: ActiveSignal) => {
    if (!mapRef.current) return;
    if (overlayMapRef.current.has(sig._id)) return;
    const pos = new window.kakao.maps.LatLng(sig.lat, sig.lng);
    const ov = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: makePulseContent(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1,
      clickable: false
    });
    ov.setMap(mapRef.current);
    overlayMapRef.current.set(sig._id, ov);
  }, []);

  const removeOverlay = useCallback((signalId: string) => {
    const ov = overlayMapRef.current.get(signalId);
    if (ov) {
      ov.setMap(null);
      overlayMapRef.current.delete(signalId);
    }
  }, []);

  const reconcileOverlays = useCallback((activeItems: ActiveSignal[]) => {
    const nextIds = new Set(activeItems.map(s => s._id));
    activeItems.forEach(s => addOverlay(s));
    Array.from(overlayMapRef.current.keys()).forEach((id) => {
      if (!nextIds.has(id)) removeOverlay(id);
    });
  }, [addOverlay, removeOverlay]);

  const fetchActiveSignals = useCallback(async (toiletIds: string[]) => {
    if (!toiletIds.length) return;
    try {
      const idsParam = encodeURIComponent(toiletIds.join(','));
      const resp = await fetch(`/api/signal/active?toiletIds=${idsParam}`, { cache: 'no-store' });
      if (!resp.ok) return;
      const data = (await resp.json()) as { items?: ActiveSignal[] };
      reconcileOverlays(data.items ?? []);
    } catch {
      // ignore
    }
  }, [reconcileOverlays]);

  const drawMarkers = useCallback((toilets: Toilet[]) => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    toilets.forEach((place) => {
      const pos = new window.kakao.maps.LatLng(place.lat, place.lng);
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: pos,
        image: new window.kakao.maps.MarkerImage('/marker/toilet-icon.png', new window.kakao.maps.Size(40, 40)),
        zIndex: 10,
      });
      markersRef.current.push(marker);

      const html =
        `<div class="custom-overlay">
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
        clickable: false
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        if (currentOverlayRef.current && currentOverlayRef.current !== overlay) {
          currentOverlayRef.current.setMap(null);
        }
        (mapRef.current as MapWithPanTo).panTo(pos);
        overlay.setMap(mapRef.current);
        currentOverlayRef.current = overlay;

        content.querySelector('.custom-close-btn')?.addEventListener('click', () => {
          overlay.setMap(null);
          if (currentOverlayRef.current === overlay) currentOverlayRef.current = null;
        });
      });

      window.kakao.maps.event.addListener(marker, 'dblclick', () => {
        router.push(
          `/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}`
        );
      });
    });

    if (socketRef.current) {
      const nextIds = new Set(toilets.map((t) => t.id));
      toilets.forEach((t) => {
        if (!joinedRoomsRef.current.has(t.id)) {
          socketRef.current!.emit('join_toilet', t.id);
          joinedRoomsRef.current.add(t.id);
        }
      });
      for (const id of Array.from(joinedRoomsRef.current)) {
        if (!nextIds.has(id)) {
          socketRef.current.emit('leave_toilet', id);
          joinedRoomsRef.current.delete(id);
        }
      }
    }

    fetchActiveSignals(toilets.map((t) => t.id));
  }, [fetchActiveSignals, pathname, router]);

  const searchToilets = useCallback(async (lat: number, lng: number, shouldCenter = true) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        const enriched = await Promise.all(
          data.map(async (p: KakaoPlace) => {
            const res = await fetch(`/api/toilet/${p.id}?place_name=${encodeURIComponent(p.place_name)}`);
            const db = (await res.json()) as ToiletDbData;
            return {
              ...p,
              overallRating: db.overallRating ?? 3,
              reviews: db.reviews ?? [],
              keywords: db.keywords ?? [],
            };
          })
        );

        const converted: Toilet[] = enriched
          .map((t) => ({ ...t, lat: toNum(t.y) ?? 0, lng: toNum(t.x) ?? 0 }))
          .filter((t) => t.lat && t.lng);

        setToiletList(converted);
        localStorage.setItem('toiletList', JSON.stringify(converted));
        setAllToilets(converted);
        drawMarkers(converted);

        if (shouldCenter && mapRef.current) {
          (mapRef.current as MapWithPanTo).panTo(new window.kakao.maps.LatLng(lat, lng));
        }
      },
      { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 }
    );
  }, [drawMarkers, setToiletList]);

  const handleQuerySearch = useCallback((keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const { y, x } = result[0];
        const coords = new window.kakao.maps.LatLng(+y, +x);
        (mapRef.current as MapWithPanTo).panTo(coords);
        searchToilets(+y, +x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  }, [searchToilets]);

  useEffect(() => {
    if (queryKeyword) handleQuerySearch(queryKeyword);
  }, [queryKeyword, handleQuerySearch]);

  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true;
    document.head.appendChild(s);

    s.onload = () => {
      window.kakao.maps.load(() => {
        const initMap = (lat: number, lng: number) => {
          const center = new window.kakao.maps.LatLng(lat, lng);
          const mapEl = document.getElementById('map');
          if (!mapEl) return;

          mapRef.current = new window.kakao.maps.Map(mapEl, { center, level: 3 });
          currentPosRef.current = center;

          (async () => {
            await fetch('/api/socketio-init', { cache: 'no-store' }).catch(() => {});
            const socket = io({ path: '/api/socket', transports: ['websocket'] });
            socketRef.current = socket;

            socket.on('connect', () => {
              socket.emit('join_toilet', 'ALL');
            });

            const reSync = () => {
              const currentIds = (allToilets.length ? allToilets : []).map(t => t.id);
              fetchActiveSignals(currentIds);
            };

            socket.on('signals_changed', reSync);
            socket.onAny((evt) => {
              const e = String(evt);
              if (e.startsWith('paper_') || e.startsWith('signal_')) reSync();
            });

            const pollId = window.setInterval(reSync, 10000);
            const onFocus = () => reSync();
            window.addEventListener('focus', onFocus);

            (socketRef as React.MutableRefObject<Socket & { __cleanup?: () => void }>).current.__cleanup = () => {
              window.clearInterval(pollId);
              window.removeEventListener('focus', onFocus);
              socket.off('signals_changed', reSync);
              socket.offAny();
              socket.disconnect();
            };
          })();

          searchToilets(lat, lng);
          if (queryKeyword) handleQuerySearch(queryKeyword);

          window.kakao.maps.event.addListener(mapRef.current, 'idle', () => {
            if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(() => {
              const c = (mapRef.current as MapWithGetCenter).getCenter() as LatLngWithGet;
              searchToilets(c.getLat(), c.getLng(), false);
            }, 400);
          });
        };

        navigator.geolocation.getCurrentPosition(
          (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
          () => initMap(37.5665, 126.9780)
        );
      });
    };

    return () => {
      const sref = socketRef.current as Socket & { __cleanup?: () => void } | null;
      if (sref?.__cleanup) sref.__cleanup();
      else socketRef.current?.disconnect();

      // cleanup 시 ref 스냅샷을 만들어 경고 제거
      const overlaysSnapshot = Array.from(overlayMapRef.current.values());
      overlaysSnapshot.forEach(ov => ov.setMap(null));
      overlayMapRef.current.clear();
    };
    // 의존성에 fetchActiveSignals 추가
  }, [queryKeyword, searchToilets, handleQuerySearch, allToilets, fetchActiveSignals]);

  useEffect(() => {
    let currentMarker: kakao.maps.Marker | null = null;
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      if (!mapRef.current) return;
      const latLng = new window.kakao.maps.LatLng(coords.latitude, coords.longitude);
      currentPosRef.current = latLng;

      if (!currentMarker) {
        currentMarker = new window.kakao.maps.Marker({
          map: mapRef.current,
          position: latLng,
          image: new window.kakao.maps.MarkerImage('/marker/location-icon.png', new window.kakao.maps.Size(36, 36)),
          zIndex: 9999,
        });
      } else {
        (currentMarker as MarkerWithSetPosition).setPosition(latLng);
      }
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleLocateClick = () => {
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
