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

type PaperSignalEvent = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  expiresAt: string;
};
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
  const activeOverlayMapRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<Toilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const queryKeyword = searchParams?.get('query');

  // 화면 스크롤 잠금 (지도를 꽉 차게)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 펄스 오버레이 추가 (중복 방지 + 마커 클릭 방해 X)
  const addPulseOverlay = useCallback((payload: PaperSignalEvent | ActiveSignal) => {
    if (!mapRef.current) return;
    if (activeOverlayMapRef.current.has(payload._id)) return;

    const pos = new window.kakao.maps.LatLng(payload.lat, payload.lng);
    const el = document.createElement('div');
    el.className = 'pulse-wrapper';
    el.innerHTML = '<div class="pulse-signal"></div>';

    const overlay = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: el,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1,       // 마커(기본 3)보다 낮게
      clickable: false // 클릭 이벤트 자체를 가지지 않게
    });
    overlay.setMap(mapRef.current);
    activeOverlayMapRef.current.set(payload._id, overlay);

    const msLeft = Math.max(new Date(payload.expiresAt).getTime() - Date.now(), 5000);
    window.setTimeout(() => {
      overlay.setMap(null);
      activeOverlayMapRef.current.delete(payload._id);
    }, msLeft);
  }, []);

  // 펄스 제거(수락/취소 등)
  const removePulseOverlay = useCallback((signalId: string) => {
    const ov = activeOverlayMapRef.current.get(signalId);
    if (ov) {
      ov.setMap(null);
      activeOverlayMapRef.current.delete(signalId);
    }
  }, []);

  // 현재 마커들에 대한 활성 신호 캐치업
  const fetchActiveSignals = useCallback(async (toiletIds: string[]) => {
    if (!toiletIds.length) return;
    try {
      const idsParam = encodeURIComponent(toiletIds.join(','));
      const resp = await fetch(`/api/signal/active?toiletIds=${idsParam}`);
      if (!resp.ok) return;
      const data = (await resp.json()) as { items?: ActiveSignal[] };
      if (!data.items?.length) return;

      data.items.forEach((sig) => {
        addPulseOverlay({
          _id: sig._id,
          toiletId: sig.toiletId,
          lat: sig.lat,
          lng: sig.lng,
          expiresAt: sig.expiresAt,
        });
      });
    } catch {
      // ignore
    }
  }, [addPulseOverlay]);

  // 마커 그리기 + 룸 동기화 + 캐치업
  const drawMarkers = useCallback((toilets: Toilet[]) => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    toilets.forEach((place) => {
      const pos = new window.kakao.maps.LatLng(place.lat, place.lng);
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: pos,
        image: new window.kakao.maps.MarkerImage(
          '/marker/toilet-icon.png',
          new window.kakao.maps.Size(40, 40)
        ),
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

    // 룸 join/leave
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

    // 캐치업
    fetchActiveSignals(toilets.map((t) => t.id));
  }, [fetchActiveSignals, pathname, router]);

  // 화장실 검색
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

  // 주소 검색
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

  // 지도 초기화 + 소켓 연결
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

          // 소켓 서버 초기화 → 연결
          (async () => {
            const resp = await fetch('/api/socketio-init', { cache: 'no-store' });
            if (!resp.ok) {
              console.error('socket init failed', resp.status);
              return;
            }
            const socket = io({ path: '/api/socket', transports: ['websocket'] });
            socketRef.current = socket;

            socket.on('connect', () => {
              console.log('✅ socket connected', socket.id);
              // 개발용 ALL 구독은 제거하고, 보이는 마커별 join으로만 운용
            });
            socket.on('connect_error', (err) => console.log('❌ connect_error', err.message));

            socket.on('paper_request', (p: PaperSignalEvent) => addPulseOverlay(p));
            socket.on('paper_accepted', (p: { _id: string }) => removePulseOverlay(p._id));
            socket.on('paper_accept_canceled', () => {
              // 취소 시 다시 깜빡이고 싶다면 active 캐치업을 트리거하거나 서버에서 재발행 이벤트를 추가하세요.
            });
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
      socketRef.current?.off('paper_request');
      socketRef.current?.off('paper_accepted');
      socketRef.current?.off('paper_accept_canceled');
      socketRef.current?.disconnect();
    };
  }, [queryKeyword, searchToilets, handleQuerySearch, addPulseOverlay, removePulseOverlay]);

  // 현재 위치 마커
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

  // 필터 변경 시 마커 리프레시
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
