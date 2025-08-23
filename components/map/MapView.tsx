// components/map/MapView.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import io, { Socket } from 'socket.io-client';

// Header는 클라 전용 로드
const Header = dynamic(() => import('@/components/common/Header'), { ssr: false });

/* ===== 전역 Window 타입 보강 (any 금지) ===== */
declare global {
  interface Window {
    __KAKAO_MAPS_LOADED?: boolean;
    kakao: typeof kakao;
  }
}

/* ----------------------------- 상수 ----------------------------- */
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

const SEARCH_DISTANCE_M = 500;     // idle 후 재검색 최소 이동거리
const SEARCH_COOLDOWN_MS = 4000;   // idle 후 재검색 최소 간격

/* ----------------------------- 타입 ----------------------------- */
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

/* ---- 카카오 보조 타입(전역 kakao를 수정하지 않고 구조 타이핑) ---- */
type MapWithGetCenter = kakao.maps.Map & { getCenter(): kakao.maps.LatLng };
type MapWithPanTo = kakao.maps.Map & { panTo(pos: kakao.maps.LatLng): void };
type LatLngBoundsLike = { contain: (latlng: kakao.maps.LatLng) => boolean };
type MapWithBounds = kakao.maps.Map & { getBounds(): LatLngBoundsLike };
type LatLngGettable = kakao.maps.LatLng & { getLat(): number; getLng(): number };
type MarkerWithSetPosition = kakao.maps.Marker & { setPosition(pos: kakao.maps.LatLng): void };
type SocketWithCleanup = Socket & { __cleanup?: () => void };

/* ----------------------------- 유틸 ----------------------------- */
const toNum = (v?: string | number | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 두 좌표간 거리(m) */
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

/** Kakao SDK 로더(싱글톤, any 없음) */
function loadKakao(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.__KAKAO_MAPS_LOADED) return Promise.resolve();
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('#kakao-sdk');
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = 'kakao-sdk';
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true;
    s.addEventListener('load', () => {
      window.__KAKAO_MAPS_LOADED = true;
      s.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    document.head.appendChild(s);
  });
}

/** 배포에서 정적 자산 존재 여부 확인 */
async function assetExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/** 정적 자산이 있을 때만 마커 이미지 적용 (없으면 기본 마커 유지) */
async function setMarkerImageIfExists(
  marker: kakao.maps.Marker,
  path: string,
  size: kakao.maps.Size
) {
  if (await assetExists(path)) {
    const img = new window.kakao.maps.MarkerImage(path, size);
    marker.setImage(img);
  }
}

/* --------------------------- 컴포넌트 --------------------------- */
export default function MapView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersByIdRef = useRef<Map<String, kakao.maps.Marker>>(new Map());
  const currentPosRef = useRef<kakao.maps.LatLng | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);

  // 재검색 제어
  const lastSearchCenterRef = useRef<LatLngGettable | null>(null);
  const lastSearchAtRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // 소켓/오버레이
  const socketRef = useRef<SocketWithCleanup | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const overlayMapRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<Toilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const queryKeyword = searchParams?.get('query') ?? '';

  /* -------- 화면 스크롤 잠금 -------- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* -------- 신호 오버레이 -------- */
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
    if (!mapRef.current || overlayMapRef.current.has(sig._id)) return;
    const pos = new window.kakao.maps.LatLng(sig.lat, sig.lng);
    const ov = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: makePulseContent(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1, // 마커보다 아래
      clickable: false,
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
    Array.from(overlayMapRef.current.keys()).forEach(id => {
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

  /* -------- 마커 DIFF 렌더링(+ room 동기화 + 캐치업) -------- */
  const drawMarkers = useCallback((toilets: Toilet[]) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const nextIds = new Set<string>(toilets.map(t => t.id));

    // 제거: 사라진 마커 제거
    for (const [id, m] of markersByIdRef.current.entries()) {
      if (!nextIds.has(id as string)) {
        m.setMap(null);
        markersByIdRef.current.delete(id);
      }
    }

    // 추가/업데이트
    toilets.forEach(place => {
      const pos = new window.kakao.maps.LatLng(place.lat, place.lng);
      let marker = markersByIdRef.current.get(place.id);
      if (!marker) {
        marker = new window.kakao.maps.Marker({
          map,
          position: pos,
          zIndex: 10, // 우선 기본 마커로 띄움
        });
        markersByIdRef.current.set(place.id, marker);

        // ✅ 배포에서 파일이 있을 때만 이미지 입히기 (없으면 기본 마커 유지)
        void setMarkerImageIfExists(marker, '/marker/toilet-icon.png', new window.kakao.maps.Size(40, 40));

        // 오버레이
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

        // ✅ 마커 클릭 시: 위치로 panTo + 오버레이 열기
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

        // 더블클릭: 디테일 이동
        window.kakao.maps.event.addListener(marker, 'dblclick', () => {
          router.push(`/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}`);
        });
      } else {
        // 위치 업데이트(변경 가능성은 낮지만 안전하게)
        (marker as MarkerWithSetPosition).setPosition(pos);
      }
    });

    // room join/leave 동기화
    if (socketRef.current) {
      // join
      toilets.forEach(t => {
        if (!joinedRoomsRef.current.has(t.id)) {
          socketRef.current!.emit('join_toilet', t.id);
          joinedRoomsRef.current.add(t.id);
        }
      });
      // leave
      for (const id of Array.from(joinedRoomsRef.current)) {
        if (!nextIds.has(id)) {
          socketRef.current.emit('leave_toilet', id);
          joinedRoomsRef.current.delete(id);
        }
      }
    }

    // 현재 보이는 화장실들에 대한 활성 신호 캐치업
    fetchActiveSignals(toilets.map(t => t.id));
  }, [fetchActiveSignals, pathname, router]);

  /* -------- 화장실 검색 -------- */
  const searchToilets = useCallback(async (lat: number, lng: number, shouldCenter = false) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        const enriched = await Promise.all(
          (data as KakaoPlace[]).map(async (p) => {
            const res = await fetch(`/api/toilet/${p.id}?place_name=${encodeURIComponent(p.place_name)}`);
            const db = (await res.json()) as ToiletDbData;
            return { ...p, overallRating: db.overallRating ?? 3, reviews: db.reviews ?? [], keywords: db.keywords ?? [] };
          })
        );

        const converted: Toilet[] = enriched
          .map(t => ({ ...t, lat: toNum(t.y) ?? 0, lng: toNum(t.x) ?? 0 }))
          .filter(t => t.lat && t.lng);

        setToiletList(converted);
        localStorage.setItem('toiletList', JSON.stringify(converted));
        setAllToilets(converted);
        drawMarkers(converted);

        // 검색 기준 업데이트
        lastSearchCenterRef.current = new window.kakao.maps.LatLng(lat, lng) as LatLngGettable;
        lastSearchAtRef.current = Date.now();

        if (shouldCenter && mapRef.current) {
          (mapRef.current as MapWithPanTo).panTo(new window.kakao.maps.LatLng(lat, lng));
        }
      },
      { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 }
    );
  }, [drawMarkers, setToiletList]);

  /* -------- 주소 검색(사용자 입력) -------- */
  const handleQuerySearch = useCallback((keyword: string) => {
    if (!keyword) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const { y, x } = result[0];
        const coords = new window.kakao.maps.LatLng(+y, +x);
        (mapRef.current as MapWithPanTo).panTo(coords);
        searchToilets(+y, +x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  }, [searchToilets]);

  useEffect(() => { if (queryKeyword) handleQuerySearch(queryKeyword); }, [queryKeyword, handleQuerySearch]);

  /* -------- 지도/소켓 초기화 -------- */
  useEffect(() => {
    let canceled = false;

    (async () => {
      await loadKakao();
      if (canceled) return;

      window.kakao.maps.load(() => {
        const initMap = (lat: number, lng: number) => {
          if (canceled) return;
          const center = new window.kakao.maps.LatLng(lat, lng);
          const mapEl = document.getElementById('map');
          if (!mapEl) return;

          // 지도 생성(초기 1회만 센터 지정)
          mapRef.current = new window.kakao.maps.Map(mapEl, { center, level: 3 });
          currentPosRef.current = center;
          lastSearchCenterRef.current = center as LatLngGettable;
          lastSearchAtRef.current = Date.now();

          // 소켓 연결(보이는 화장실만 방 조인)
          (async () => {
            await fetch('/api/socketio-init', { cache: 'no-store' }).catch(() => {});
            const socket = io({ path: '/api/socket', transports: ['websocket'] }) as SocketWithCleanup;
            socketRef.current = socket;

            const reSync = () => {
              const ids = Array.from(markersByIdRef.current.keys()).map(String);
              fetchActiveSignals(ids);
            };

            socket.on('connect', () => { /* no-op */ });
            socket.on('signals_changed', reSync);
            socket.onAny((evtName: string) => {
              if (evtName.startsWith('paper_') || evtName.startsWith('signal_')) reSync();
            });

            // 폴백: 20초마다 / 포커스시 동기화
            const pollId = window.setInterval(reSync, 20000);
            const onFocus = () => reSync();
            window.addEventListener('focus', onFocus);

            socketRef.current.__cleanup = () => {
              window.clearInterval(pollId);
              window.removeEventListener('focus', onFocus);
              socket.off('signals_changed', reSync);
              socket.offAny();
              socket.disconnect();
            };
          })();

          // 첫 검색은 페인트 이후로 지연하여 체감 렌더 빠르게
          requestAnimationFrame(() => searchToilets(lat, lng, false));
          if (queryKeyword) handleQuerySearch(queryKeyword);

          // idle 핸들러(500m/4s 조건 만족 시에만)
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

        // 현재 위치 → 초기 1회만 센터
        navigator.geolocation.getCurrentPosition(
          (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
          ()   => initMap(37.5665, 126.9780),
          { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
        );
      });
    })();

    // cleanup (스냅샷으로 경고 제거)
    return () => {
      canceled = true;

      const sref = socketRef.current;
      if (sref?.__cleanup) sref.__cleanup();
      else socketRef.current?.disconnect();

      const overlaysSnapshot = Array.from(overlayMapRef.current.values());
      overlaysSnapshot.forEach(ov => ov.setMap(null));
      overlayMapRef.current.clear();

      const markersSnapshot = Array.from(markersByIdRef.current.values());
      markersSnapshot.forEach(m => m.setMap(null));
      markersByIdRef.current.clear();
    };
  }, [queryKeyword, searchToilets, handleQuerySearch, fetchActiveSignals]);

  /* -------- 현재 위치 마커: watchPosition + 3초 폴백 -------- */
  useEffect(() => {
    let currentMarker: kakao.maps.Marker | null = null;
    let watcherId: number | null = null;

    const placeOrMove = (lat: number, lng: number) => {
      if (!mapRef.current) return;
      const latLng = new window.kakao.maps.LatLng(lat, lng);
      currentPosRef.current = latLng;
      if (!currentMarker) {
        currentMarker = new window.kakao.maps.Marker({
          map: mapRef.current,
          position: latLng,
          zIndex: 9999, // 기본 마커로 우선 표시
        });
        // 파일 있으면만 아이콘 적용
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

    // 3초 내 업데이트가 없으면 맵 센터에 폴백 마커
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

  /* -------- 현재 위치로 이동 버튼 -------- */
  const handleLocateClick = () => {
    if (mapRef.current && currentPosRef.current) {
      (mapRef.current as MapWithPanTo).panTo(currentPosRef.current);
    }
  };

  /* -------- 필터 변경 시 마커 리프레시 -------- */
  useEffect(() => {
    drawMarkers(
      selectedFilters.length
        ? allToilets.filter((t) => selectedFilters.every((f) => t.keywords.includes(f)))
        : allToilets
    );
  }, [selectedFilters, allToilets, drawMarkers]);

  /* ====== 렌더 ====== */
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

      {/* 지도를 꽉 채우고, 위치 버튼은 오버레이로 */}
      <div className="map-container">
        <div id="map" />
        <button type="button" className="loc-btn" onClick={handleLocateClick}>
          📍
        </button>
      </div>
    </div>
  );
}
