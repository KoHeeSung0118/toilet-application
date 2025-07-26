'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Header from '@/components/common/Header';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';

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
];

/* ----------------------------- 타입 ----------------------------- */
interface KakaoPlace {
  id: string;
  place_name: string;
  x: string;
  y: string;
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

/* kakao 전역 타입 보강 + Marker 확장(setPosition) */
declare global {
  interface Window { kakao: typeof kakao; }
}
type KakaoMarker = kakao.maps.Marker & {
  setPosition(pos: kakao.maps.LatLng): void;
};

/* ----------------------------- 컴포넌트 ----------------------------- */
export default function MapView() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { setToiletList } = useToilet();

  const mapRef         = useRef<kakao.maps.Map | null>(null);
  const markersRef     = useRef<kakao.maps.Marker[]>([]);
  const currentPosRef  = useRef<kakao.maps.LatLng | null>(null); // ★ 현재 위치 저장

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets]           = useState<Toilet[]>([]);
  const [showFilters, setShowFilters]         = useState(false);
  const queryKeyword = searchParams?.get('query');

  /* ---------------- 화장실 검색 ---------------- */
  const searchToilets = useCallback(async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        const enriched: EnrichedToilet[] = await Promise.all(
          data.map(async place => {
            const res = await fetch(`/api/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}`);
            const db  = (await res.json()) as ToiletDbData;
            return {
              ...place,
              overallRating: db.overallRating ?? 3,
              reviews:       db.reviews ?? [],
              keywords:      db.keywords ?? [],
            };
          })
        );

        const converted: Toilet[] = enriched.map(t => ({
          ...t,
          lat: parseFloat(t.y),
          lng: parseFloat(t.x),
        }));

        setToiletList(converted);
        localStorage.setItem('toiletList', JSON.stringify(converted));
        setAllToilets(converted);

        drawMarkers(converted);          // 초기 마커 렌더
      },
      { location: new window.kakao.maps.LatLng(lat, lng), radius: 20000 }
    );
  }, [pathname, setToiletList]);

  /* ---------------- 공통 마커 그리기 ---------------- */
  const drawMarkers = (toilets: Toilet[]) => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    let currentOverlay: kakao.maps.CustomOverlay | null = null;

    toilets.forEach(place => {
      const pos    = new window.kakao.maps.LatLng(place.lat, place.lng);
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
        mapRef.current?.panTo(pos);
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
  };

  /* ---------------- 주소 검색 ---------------- */
  const handleQuerySearch = useCallback((keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const { y, x } = result[0];
        const coords   = new window.kakao.maps.LatLng(+y, +x);
        mapRef.current?.setCenter(coords);
        searchToilets(+y, +x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  }, [searchToilets]);

  /* ---------------- Kakao SDK 로드 & 지도 초기화 ---------------- */
  useEffect(() => {
    const s = document.createElement('script');
    s.src   = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true;
    document.head.appendChild(s);

    s.onload = () => {
      window.kakao.maps.load(() => {
        const initMap = (lat: number, lng: number) => {
          const center = new window.kakao.maps.LatLng(lat, lng);
          mapRef.current = new window.kakao.maps.Map(document.getElementById('map')!, { center, level: 3 });

          searchToilets(lat, lng);
          if (queryKeyword) handleQuerySearch(queryKeyword);
        };

        navigator.geolocation.getCurrentPosition(
          pos => initMap(pos.coords.latitude, pos.coords.longitude),
          ()  => initMap(37.5665, 126.9780)
        );
      });
    };
  }, [queryKeyword, searchToilets, handleQuerySearch]);

  /* ---------------- 실시간 위치 추적 ---------------- */
  useEffect(() => {
    let currentLocationMarker: KakaoMarker | null = null;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (!mapRef.current) return;
        const latLng = new window.kakao.maps.LatLng(coords.latitude, coords.longitude);

        currentPosRef.current = latLng;                           // ★ 현재 위치 저장

        if (!currentLocationMarker) {
          currentLocationMarker = new window.kakao.maps.Marker({
            map: mapRef.current,
            position: latLng,
            image: new window.kakao.maps.MarkerImage('/marker/location-icon.png', new window.kakao.maps.Size(36, 36)),
            zIndex: 9999,
          }) as KakaoMarker;
        } else {
          currentLocationMarker.setPosition(latLng);
        }
      },
      () => alert('실시간 위치 추적에 실패했습니다.'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  /* ---------------- 현재 위치로 이동 버튼 ---------------- */
  const handleLocateClick = () => {
    if (mapRef.current && currentPosRef.current) {
      mapRef.current.panTo(currentPosRef.current);
    }
  };

  /* ---------------- 필터링 시 마커 갱신 ---------------- */
  const filtered = selectedFilters.length
    ? allToilets.filter(t => selectedFilters.every(f => t.keywords.includes(f)))
    : allToilets;

  useEffect(() => {
    drawMarkers(filtered);
  }, [filtered]);

  /* ---------------- JSX ---------------- */
  return (
    <div className="map-wrapper">
      <Header />

      {/* 상단 필터 UI */}
      <div className="top-ui">
        <button className="toggle-filter-btn" onClick={() => setShowFilters(p => !p)}>
          {showFilters ? '키워드 숨기기' : '키워드 보기'}
        </button>

        {showFilters && (
          <div className="keyword-filter">
            {FILTERS.map(filter => (
              <button
                key={filter}
                className={`filter-btn ${selectedFilters.includes(filter) ? 'active' : ''}`}
                onClick={() =>
                  setSelectedFilters(prev =>
                    prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
                  )
                }
              >
                #{filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 지도 + 현재 위치 이동 버튼 */}
      <div id="map" className="map-container">
        <button className="loc-btn" onClick={handleLocateClick}>📍</button>
      </div>
    </div>
  );
}
