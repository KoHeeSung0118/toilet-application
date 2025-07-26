'use client';
/* eslint-disable @typescript-eslint/no-namespace */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';

/* ----------------------------- 상수 ----------------------------- */
const FILTERS = [
  '화장실 칸 많음', '화장실 칸 적음', '장애인 화장실', '성별 분리',
  '비데 설치 되어있음', '휴지 많음', '물 잘나옴', '냄새 좋음',
];

/* ----------------------------- 타입 ----------------------------- */
interface KakaoPlace { id: string; place_name: string; x: string; y: string; }
interface ToiletDbData { overallRating?: number; reviews?: { user: string; comment: string }[]; keywords?: string[]; }
interface EnrichedToilet extends KakaoPlace { overallRating: number; reviews: { user: string; comment: string }[]; keywords: string[]; }
interface Toilet extends EnrichedToilet { lat: number; lng: number; }

/* kakao 타입 보강 */
declare global {
  interface Window { kakao: typeof kakao; }

  namespace kakao.maps {
    interface Map { getCenter(): kakao.maps.LatLng; }
    interface LatLng { getLat(): number; getLng(): number; }
  }
}

type KakaoMarker = kakao.maps.Marker & { setPosition(pos: kakao.maps.LatLng): void; };
const toNum = (v?: string | number | null) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/* ----------------------------- 컴포넌트 ----------------------------- */
export default function MapView() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef        = useRef<kakao.maps.Map | null>(null);
  const markersRef    = useRef<kakao.maps.Marker[]>([]);
  const currentPosRef = useRef<kakao.maps.LatLng | null>(null);
  const idleTimerRef  = useRef<NodeJS.Timeout | null>(null);

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets]           = useState<Toilet[]>([]);
  const [showFilters, setShowFilters]         = useState(false);

  const queryKeyword = searchParams?.get('query');

  /* -------- 마커 그리기 (useCallback) -------- */
  const drawMarkers = useCallback((toilets: Toilet[]) => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    let currentOverlay: kakao.maps.CustomOverlay | null = null;

    toilets.forEach(place => {
      const pos = new window.kakao.maps.LatLng(place.lat, place.lng);
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: pos,
        image: new window.kakao.maps.MarkerImage('/marker/toilet-icon.png', new window.kakao.maps.Size(40, 40)),
      });
      markersRef.current.push(marker);

      const html = `
        <div class="custom-overlay">
          <button class="custom-close-btn">&times;</button>
          <div class="info-title">${place.place_name}</div>
          <div class="info-rating">★ ${place.overallRating.toFixed(1)}</div>
          <div class="info-keywords">${place.keywords.map(k => `<span>#${k}</span>`).join('')}</div>
          <a class="info-link" href="/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}">자세히 보기</a>
        </div>`;
      const content = Object.assign(document.createElement('div'), { innerHTML: html });
      const overlay = new window.kakao.maps.CustomOverlay({ content, position: pos, xAnchor: 0.5, yAnchor: 1.1 });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        if (currentOverlay && currentOverlay !== overlay) currentOverlay.setMap(null);
        mapRef.current?.panTo(pos);                         /* 중심 이동 */
        overlay.setMap(mapRef.current);
        currentOverlay = overlay;
        content.querySelector('.custom-close-btn')?.addEventListener('click', () => {
          overlay.setMap(null);
          if (currentOverlay === overlay) currentOverlay = null;
        });
      });

      window.kakao.maps.event.addListener(marker, 'dblclick', () => {
        router.push(`/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}&from=${encodeURIComponent(pathname || '')}`);
      });
    });
  }, [pathname, router]);

  /* -------- 화장실 검색 -------- */
  const searchToilets = useCallback(async (lat: number, lng: number, shouldCenter = true) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch('화장실', async (data, status) => {
      if (status !== window.kakao.maps.services.Status.OK) return;

      const enriched = await Promise.all(
        data.map(async (p: KakaoPlace) => {
          const res = await fetch(`/api/toilet/${p.id}?place_name=${encodeURIComponent(p.place_name)}`);
          const db  = (await res.json()) as ToiletDbData;
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

      if (shouldCenter && mapRef.current) {
        mapRef.current.panTo(new window.kakao.maps.LatLng(lat, lng));
      }
    }, { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 });
  }, [drawMarkers, setToiletList]);

  /* -------- 주소 검색 -------- */
  const handleQuerySearch = useCallback((keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const { y, x } = result[0];
        const coords = new window.kakao.maps.LatLng(+y, +x);
        mapRef.current?.setCenter(coords);
        mapRef.current?.panTo(coords);
        searchToilets(+y, +x);
      } else alert('검색 결과가 없습니다.');
    });
  }, [searchToilets]);

  /* URL query → 재검색 */
  useEffect(() => { if (queryKeyword) handleQuerySearch(queryKeyword); }, [queryKeyword, handleQuerySearch]);

  /* -------- Kakao SDK 로드 & 초기화 -------- */
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true; document.head.appendChild(s);

    s.onload = () => {
      window.kakao.maps.load(() => {
        const initMap = (lat: number, lng: number) => {
          const center = new window.kakao.maps.LatLng(lat, lng);
          mapRef.current = new window.kakao.maps.Map(document.getElementById('map') as HTMLElement, { center, level: 3 });
          currentPosRef.current = center;

          searchToilets(lat, lng);
          if (queryKeyword) handleQuerySearch(queryKeyword);

          window.kakao.maps.event.addListener(mapRef.current!, 'idle', () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
              const c = mapRef.current!.getCenter();
              searchToilets(c.getLat(), c.getLng(), false);
            }, 400);
          });
        };

        navigator.geolocation.getCurrentPosition(
          pos => initMap(pos.coords.latitude, pos.coords.longitude),
          ()  => initMap(37.5665, 126.9780)
        );
      });
    };
  }, [queryKeyword, searchToilets, handleQuerySearch]);

  /* -------- 실시간 위치 추적 -------- */
  useEffect(() => {
    let currentMarker: KakaoMarker | null = null;
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
        }) as KakaoMarker;
      } else currentMarker.setPosition(latLng);
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* 현재 위치 버튼 */
  const handleLocateClick = () => { if (mapRef.current && currentPosRef.current) mapRef.current.panTo(currentPosRef.current); };

  /* 필터링 시 마커 갱신 */
  useEffect(() => { drawMarkers(
      selectedFilters.length
        ? allToilets.filter(t => selectedFilters.every(f => t.keywords.includes(f)))
        : allToilets
    ); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilters, allToilets]);

  /* ---------------- JSX ---------------- */
  return (
    <div className="map-wrapper">
      <Header />
      <div className="top-ui">
        <button className="toggle-filter-btn" onClick={() => setShowFilters(p => !p)}>
          {showFilters ? '키워드 숨기기' : '키워드 보기'}
        </button>
        {showFilters && (
          <div className="keyword-filter">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`filter-btn ${selectedFilters.includes(f) ? 'active' : ''}`}
                onClick={() =>
                  setSelectedFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
                }
              >
                #{f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div id="map" className="map-container">
        <button className="loc-btn" onClick={handleLocateClick}>📍</button>
      </div>
    </div>
  );
}
