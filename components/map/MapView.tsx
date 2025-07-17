'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation'; // ★
import Header from '@/components/common/Header';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';

/* ───────── 상수 & 타입 ───────── */
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

/* ───────── 컴포넌트 ───────── */
export default function MapView() {
  const router      = useRouter();            // ★
  const pathname    = usePathname();          // ★
  const searchParams = useSearchParams();

  const { setToiletList } = useToilet();

  const mapRef     = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);

  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets,     setAllToilets]     = useState<EnrichedToilet[]>([]);
  const [showFilters,    setShowFilters]    = useState(false);

  const queryKeyword = searchParams?.get('query');

  /* ───────── 마커 렌더 ───────── */
  const renderMarkers = useCallback((toilets: EnrichedToilet[]) => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    let currentOverlay: kakao.maps.CustomOverlay | null = null;

    toilets.forEach(place => {
      const pos = new kakao.maps.LatLng(+place.y, +place.x);
      const marker = new kakao.maps.Marker({
        map: mapRef.current!,
        position: pos,
        image: new kakao.maps.MarkerImage(
          '/marker/toilet-icon.png',
          new kakao.maps.Size(40, 40)
        ),
      });
      markersRef.current.push(marker);

      /* ★ 오버레이 콘텐츠 (place_name·from 포함) */
      const html = `
        <div class="custom-overlay">
          <button class="custom-close-btn">&times;</button>
          <div class="info-title">${place.place_name}</div>
          <div class="info-rating">★ ${place.overallRating.toFixed(1)}</div>
          <div class="info-keywords">
            ${place.keywords.map(k => `<span>#${k}</span>`).join('')}
          </div>
          <a class="info-link"
             href="/toilet/${place.id}?place_name=${encodeURIComponent(
               place.place_name,
             )}&from=${encodeURIComponent(pathname)}">자세히 보기</a>
        </div>`;

      const content = Object.assign(document.createElement('div'), { innerHTML: html });
      const overlay = new kakao.maps.CustomOverlay({
        content,
        position: pos,
        xAnchor: 0.5,
        yAnchor: 1.1,
      });

      kakao.maps.event.addListener(marker, 'click', () => {
        if (currentOverlay && currentOverlay !== overlay) currentOverlay.setMap(null);

        mapRef.current?.panTo(pos);
        overlay.setMap(mapRef.current);
        currentOverlay = overlay;

        content
          .querySelector('.custom-close-btn')
          ?.addEventListener('click', () => {
            overlay.setMap(null);
            if (currentOverlay === overlay) currentOverlay = null;
          });
      });

      /* ★ marker 더블클릭 → 상세 페이지로 바로 이동 (선택) */
      kakao.maps.event.addListener(marker, 'dblclick', () => {
        router.push(
          `/toilet/${place.id}?place_name=${encodeURIComponent(
            place.place_name,
          )}&from=${encodeURIComponent(pathname)}`,
        );
      });
    });
  }, [pathname, router]);

  /* ───────── 화장실 검색 & 병합 ───────── */
  const searchToilets = useCallback(
    async (lat: number, lng: number) => {
      const ps = new kakao.maps.services.Places();

      ps.keywordSearch(
        '화장실',
        async (data, status) => {
          if (status !== kakao.maps.services.Status.OK) return;

          const enriched = await Promise.all(
            data.map(async place => {
              /* ★ API 호출에 place_name 쿼리 포함 */
              const res = await fetch(
                `/api/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}`,
              );
              const db = (await res.json()) as ToiletDbData;
              return {
                ...place,
                overallRating: db.overallRating ?? 3,
                reviews:       db.reviews       ?? [],
                keywords:      db.keywords      ?? [],
              };
            })
          );

          setToiletList(enriched);
          localStorage.setItem('toiletList', JSON.stringify(enriched));
          setAllToilets(enriched);
          renderMarkers(enriched);
        },
        { location: new kakao.maps.LatLng(lat, lng), radius: 20000 }
      );
    },
    [renderMarkers, setToiletList]
  );

  /* ───────── 지도 초기화 & SDK 로드 ───────── */
  useEffect(() => {
    const s = document.createElement('script');
    s.src =
      'https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services';
    s.async = true;
    document.head.appendChild(s);

    s.onload = () => {
      kakao.maps.load(() => {
        const fallback = () => {
          const lat = 37.5665, lng = 126.9780;
          mapRef.current = new kakao.maps.Map(
            document.getElementById('map')!,
            { center: new kakao.maps.LatLng(lat, lng), level: 3 }
          );
          searchToilets(lat, lng);
          if (queryKeyword) handleQuerySearch(queryKeyword);
        };

        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude, longitude } = pos.coords;
            mapRef.current = new kakao.maps.Map(
              document.getElementById('map')!,
              { center: new kakao.maps.LatLng(latitude, longitude), level: 3 }
            );
            searchToilets(latitude, longitude);
            if (queryKeyword) handleQuerySearch(queryKeyword);
          },
          fallback
        );
      });
    };
  }, [queryKeyword, searchToilets]);

  /* ───────── 주소 검색 ───────── */
  const handleQuerySearch = useCallback(
    (keyword: string) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(keyword, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          const { y, x } = result[0];
          const coords = new kakao.maps.LatLng(+y, +x);
          mapRef.current?.setCenter(coords);
          searchToilets(+y, +x);
        } else {
          alert('검색 결과가 없습니다.');
        }
      });
    },
    [searchToilets]
  );

  /* ───────── 필터 적용 시 마커 갱신 ───────── */
  const filtered = selectedFilters.length
    ? allToilets.filter(t =>
        selectedFilters.every(f => t.keywords.includes(f))
      )
    : allToilets;

  useEffect(() => {
    if (mapRef.current) renderMarkers(filtered);
  }, [filtered, renderMarkers]);

  /* ───────── UI ───────── */
  return (
    <div className="map-wrapper">
      <Header />

      <div className="top-ui">
        <button
          className="toggle-filter-btn"
          onClick={() => setShowFilters(p => !p)}
        >
          {showFilters ? '키워드 숨기기' : '키워드 보기'}
        </button>

        {showFilters && (
          <div className="keyword-filter">
            {FILTERS.map(filter => (
              <button
                key={filter}
                className={`filter-btn ${
                  selectedFilters.includes(filter) ? 'active' : ''
                }`}
                onClick={() =>
                  setSelectedFilters(prev =>
                    prev.includes(filter)
                      ? prev.filter(f => f !== filter)
                      : [...prev, filter]
                  )
                }
              >
                #{filter}
              </button>
            ))}
          </div>
        )}
      </div>

      <div id="map" className="map-container" />
    </div>
  );
}
