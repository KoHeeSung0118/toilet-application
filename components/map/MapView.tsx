'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import io, { Socket } from 'socket.io-client';

// Header는 클라이언트에서만 로드(서버/클라 경계 충돌 방지)
const Header = dynamic(() => import('@/components/common/Header'), { ssr: false });

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

/* ----------------------------- 타입 ----------------------------- */
interface KakaoPlace {
  id: string;
  place_name: string;
  x: string; // lng
  y: string; // lat
}
interface ToiletDbData {
  overallRating?: number;
  reviews?: { user: string; comment: string }[];
  keywords?: string[];
}
interface EnrichedToilet extends KakaoPlace {
  overallRating: number;
  reviews: { user: string; comment: string }[];
  keywords: string[];
}
interface Toilet extends EnrichedToilet {
  lat: number;
  lng: number;
}

/** 활성 신호(서버 /api/signal/active 응답 형태) */
type ActiveSignal = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  createdAt: string;
  expiresAt: string;
};

/* ---- 카카오 타입은 전역을 건드리지 않고 “로컬 보조 타입”으로 안전 캐스팅 ---- */
type MapWithGetCenter = kakao.maps.Map & { getCenter(): kakao.maps.LatLng };
type MapWithPanTo = kakao.maps.Map & { panTo(pos: kakao.maps.LatLng): void };
type MarkerWithSetPosition = kakao.maps.Marker & { setPosition(pos: kakao.maps.LatLng): void };
type LatLngGettable = kakao.maps.LatLng & { getLat(): number; getLng(): number };

/* ----------------------------- 유틸 ----------------------------- */
const toNum = (v?: string | number | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 두 좌표 사이 거리(m) — 보조 타입을 받아 TS 에러 제거 */
function dist(a: LatLngGettable, b: LatLngGettable): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.getLat() - a.getLat());
  const dLng = toRad(b.getLng() - a.getLng());
  const la1 = toRad(a.getLat());
  const la2 = toRad(b.getLat());
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* --------------------------- 컴포넌트 --------------------------- */
export default function MapView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const currentPosRef = useRef<kakao.maps.LatLng | null>(null);
  const currentOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null);

  // “언제/어디서 검색했는지” 를 기억해 불필요한 재검색 억제
  const lastSearchCenterRef = useRef<LatLngGettable | null>(null);
  const lastSearchAtRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // 웹소켓
  const socketRef = useRef<(Socket & { __cleanup?: () => void }) | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // 표시 중인 신호 오버레이
  const overlayMapRef = useRef<Map<string, kakao.maps.CustomOverlay>>(new Map());

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<Toilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const queryKeyword = searchParams?.get('query') ?? '';

  // 검색 기준
  const SEARCH_DISTANCE_M = 300; // 최소 이동거리
  const SEARCH_COOLDOWN_MS = 2500; // 최소 간격

  /* -------- 페이지 진입 시 바디 스크롤 잠금 -------- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* -------- 오버레이 컨텐츠(클릭 통과 + zIndex 낮게) -------- */
  const makePulseContent = () => {
    const wrap = document.createElement('div');
    wrap.style.pointerEvents = 'none';
    wrap.className = 'pulse-wrapper';
    const inner = document.createElement('div');
    inner.className = 'pulse-signal';
    wrap.appendChild(inner);
    return wrap;
  };

  /* -------- 오버레이 추가/삭제/동기화 -------- */
  const addOverlay = useCallback((sig: ActiveSignal) => {
    if (!mapRef.current) return;
    if (overlayMapRef.current.has(sig._id)) return;

    const pos = new window.kakao.maps.LatLng(sig.lat, sig.lng);
    const ov = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: makePulseContent(),
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1, // 마커 보다 아래
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

  const reconcileOverlays = useCallback(
    (activeItems: ActiveSignal[]) => {
      const nextIds = new Set(activeItems.map((s) => s._id));
      // 추가/유지
      activeItems.forEach((s) => addOverlay(s));
      // 제거
      Array.from(overlayMapRef.current.keys()).forEach((id) => {
        if (!nextIds.has(id)) removeOverlay(id);
      });
    },
    [addOverlay, removeOverlay]
  );

  /* -------- 활성 신호 캐치업(현재 보이는 화장실만) -------- */
  const fetchActiveSignals = useCallback(
    async (toiletIds: string[]) => {
      if (!toiletIds.length) return;
      try {
        const idsParam = encodeURIComponent(toiletIds.join(','));
        const resp = await fetch(`/api/signal/active?toiletIds=${idsParam}`, {
          cache: 'no-store',
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { items?: ActiveSignal[] };
        reconcileOverlays(data.items ?? []);
      } catch {
        // ignore
      }
    },
    [reconcileOverlays]
  );

  /* -------- 마커 그리기 (+ room 동기화 + 캐치업) -------- */
  const drawMarkers = useCallback(
    (toilets: Toilet[]) => {
      if (!mapRef.current) return;

      // 기존 마커 제거
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

        const html = `
          <div class="custom-overlay">
            <button class="custom-close-btn">&times;</button>
            <div class="info-title">${place.place_name}</div>
            <div class="info-rating">★ ${place.overallRating.toFixed(1)}</div>
            <div class="info-keywords">
              ${place.keywords.map((k) => `<span>#${k}</span>`).join('')}
            </div>
            <a class="info-link"
               href="/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}">
               자세히 보기
            </a>
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
            `/toilet/${place.id}?place_name=${encodeURIComponent(
              place.place_name
            )}&from=${encodeURIComponent(pathname || '')}`
          );
        });
      });

      // room join/leave 동기화
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

      // 현재 보이는 화장실들에 대한 활성 신호 캐치업
      fetchActiveSignals(toilets.map((t) => t.id));
    },
    [fetchActiveSignals, pathname, router]
  );

  /* -------- 화장실 검색 -------- */
  const searchToilets = useCallback(
    async (lat: number, lng: number, shouldCenter = true) => {
      const ps = new window.kakao.maps.services.Places();

      ps.keywordSearch(
        '화장실',
        async (data, status) => {
          if (status !== window.kakao.maps.services.Status.OK) return;

          const enriched = await Promise.all(
            (data as KakaoPlace[]).map(async (p) => {
              const res = await fetch(
                `/api/toilet/${p.id}?place_name=${encodeURIComponent(p.place_name)}`
              );
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

          // 검색 기준 업데이트(다음 idle 판단용)
          lastSearchCenterRef.current = new window.kakao.maps.LatLng(
            lat,
            lng
          ) as LatLngGettable;
          lastSearchAtRef.current = Date.now();

          if (shouldCenter && mapRef.current) {
            (mapRef.current as MapWithPanTo).panTo(
              new window.kakao.maps.LatLng(lat, lng)
            );
          }
        },
        { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 }
      );
    },
    [drawMarkers, setToiletList]
  );

  /* -------- 주소 검색 -------- */
  const handleQuerySearch = useCallback(
    (keyword: string) => {
      if (!keyword) return;
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
    },
    [searchToilets]
  );

  // 쿼리로 들어온 검색어 반영
  useEffect(() => {
    if (queryKeyword) handleQuerySearch(queryKeyword);
  }, [queryKeyword, handleQuerySearch]);

  /* -------- 지도 초기화 + 소켓 연결 -------- */
  useEffect(() => {
    const s = document.createElement('script');
    s.src =
      'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true;
    document.head.appendChild(s);

    s.onload = () => {
      window.kakao.maps.load(() => {
        const initMap = (lat: number, lng: number) => {
          const center = new window.kakao.maps.LatLng(lat, lng);
          const mapEl = document.getElementById('map');
          if (!mapEl) return;

          mapRef.current = new window.kakao.maps.Map(mapEl, {
            center,
            level: 3,
          });
          currentPosRef.current = center;
          lastSearchCenterRef.current = center as LatLngGettable;
          lastSearchAtRef.current = Date.now();

          // 소켓 준비 후 연결
          (async () => {
            await fetch('/api/socketio-init', { cache: 'no-store' }).catch(
              () => {}
            );
            const socket = io({ path: '/api/socket', transports: ['websocket'] });
            socketRef.current = socket as Socket & { __cleanup?: () => void };

            const reSync = () => {
              const currentIds = (allToilets.length ? allToilets : []).map(
                (t) => t.id
              );
              fetchActiveSignals(currentIds);
            };

            socket.on('connect', () => {
              socket.emit('join_toilet', 'ALL'); // 개발 중 전체 구독
            });

            // 서버에서 신호 변경 브로드캐스트
            socket.on('signals_changed', reSync);

            // 백업: 혹시 이벤트 이름이 달라도 catch
            socket.onAny((evtName: string) => {
              if (
                evtName.startsWith('paper_') ||
                evtName.startsWith('signal_')
              ) {
                reSync();
              }
            });

            // 폴백 폴링 & 탭 포커스 시 재동기화
            const pollId = window.setInterval(reSync, 15000);
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

          // 최초 탐색
          searchToilets(lat, lng);
          if (queryKeyword) handleQuerySearch(queryKeyword);

          // idle 시 “충분히 이동했고, 충분히 시간이 지났으면” 새로 탐색
          window.kakao.maps.event.addListener(mapRef.current, 'idle', () => {
            if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
            idleTimerRef.current = window.setTimeout(() => {
              const c = (mapRef.current as MapWithGetCenter)
                .getCenter() as LatLngGettable;

              const last = lastSearchCenterRef.current;
              const movedEnough = !last || dist(last, c) >= SEARCH_DISTANCE_M;
              const coolEnough =
                Date.now() - lastSearchAtRef.current >= SEARCH_COOLDOWN_MS;

              if (movedEnough && coolEnough) {
                searchToilets(c.getLat(), c.getLng(), false);
              }
            }, 400);
          });
        };

        // 현재 위치 얻기(센터는 최초 1회만 설정)
        navigator.geolocation.getCurrentPosition(
          (pos) => initMap(pos.coords.latitude, pos.coords.longitude),
          () => initMap(37.5665, 126.978) // 실패 시 서울시청
        );
      });
    };

    return () => {
      // 소켓 정리
      const sref = socketRef.current;
      if (sref?.__cleanup) sref.__cleanup();
      else socketRef.current?.disconnect();

      // overlay 정리 — 스냅샷으로 경고 제거
      const overlaysSnapshot = Array.from(overlayMapRef.current.values());
      overlaysSnapshot.forEach((ov) => ov.setMap(null));
      overlayMapRef.current.clear();
    };
  }, [queryKeyword, searchToilets, handleQuerySearch, allToilets, fetchActiveSignals]);

  /* -------- 현재 위치 마커(자동 센터 이동 없음) -------- */
  useEffect(() => {
    let currentMarker: kakao.maps.Marker | null = null;
    const watchId = navigator.geolocation.watchPosition(({ coords }) => {
      if (!mapRef.current) return;
      const latLng = new window.kakao.maps.LatLng(
        coords.latitude,
        coords.longitude
      );
      currentPosRef.current = latLng;

      if (!currentMarker) {
        currentMarker = new window.kakao.maps.Marker({
          map: mapRef.current,
          position: latLng,
          image: new window.kakao.maps.MarkerImage(
            '/marker/location-icon.png',
            new window.kakao.maps.Size(36, 36)
          ),
          zIndex: 9999,
        });
      } else {
        (currentMarker as MarkerWithSetPosition).setPosition(latLng);
      }
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 내 위치로 부드럽게 이동(요청 시에만)
  const handleLocateClick = () => {
    if (mapRef.current && currentPosRef.current) {
      (mapRef.current as MapWithPanTo).panTo(currentPosRef.current);
    }
  };

  /* -------- 필터 변경 시 마커 리프레시 -------- */
  useEffect(() => {
    drawMarkers(
      selectedFilters.length
        ? allToilets.filter((t) =>
            selectedFilters.every((f) => t.keywords.includes(f))
          )
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
                      prev.includes(f)
                        ? prev.filter((x) => x !== f)
                        : [...prev, f]
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
