'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '@/components/common/Header';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import { useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    kakao: any; // Kakao map은 공식 타입 제공 안 됨
  }
}

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
  [key: string]: unknown;
}

interface ToiletDbData {
  overallRating?: number;
  reviews?: unknown[];
  keywords?: string[];
}

interface EnrichedToilet extends KakaoPlace {
  overallRating: number;
  reviews: unknown[];
  keywords: string[];
}

interface KakaoMap {
  setCenter: (latlng: unknown) => void;
  panTo: (latlng: unknown) => void;
}

// ✅ 타입 가드 함수
function isValidReview(r: unknown): r is { user: string; comment: string } {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof (r as Record<string, unknown>).user === 'string' &&
    typeof (r as Record<string, unknown>).comment === 'string'
  );
}

export default function MapView() {
  const { setToiletList } = useToilet();
  const mapRef = useRef<KakaoMap | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<EnrichedToilet[]>([]);
  const [markers, setMarkers] = useState<Array<{ setMap: (map: unknown | null) => void }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchParams = useSearchParams();
  const queryKeyword = searchParams?.get('query');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            initMap(position.coords.latitude, position.coords.longitude);
            if (queryKeyword) handleQuerySearch(queryKeyword);
          },
          () => {
            initMap(37.5665, 126.9780);
            if (queryKeyword) handleQuerySearch(queryKeyword);
          }
        );
      });
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && queryKeyword) {
      handleQuerySearch(queryKeyword);
    }
  }, [queryKeyword]);

  const initMap = (lat: number, lng: number) => {
    const container = document.getElementById('map');
    const map = new window.kakao.maps.Map(container, {
      center: new window.kakao.maps.LatLng(lat, lng),
      level: 3,
    });

    mapRef.current = map as unknown as KakaoMap;
    searchToilets(lat, lng);
  };

  const handleQuerySearch = (keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(
      keyword,
      (
        result: Array<{ x: string; y: string }>,
        status: string
      ) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const coords = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
          (mapRef.current as KakaoMap).setCenter(coords);
          searchToilets(Number(result[0].y), Number(result[0].x));
        } else {
          alert('검색 결과가 없습니다.');
        }
      }
    );
  };

  const renderMarkers = (toilets: EnrichedToilet[]) => {
    markers.forEach((marker) => marker.setMap(null));
    setMarkers([]);

    let currentOverlay: { setMap: (map: unknown | null) => void } | null = null;
    const newMarkers: Array<{ setMap: (map: unknown | null) => void }> = [];

    toilets.forEach((place) => {
      const position = new window.kakao.maps.LatLng(place.y, place.x);

      const markerImage = new window.kakao.maps.MarkerImage(
        '/marker/toilet-icon.png',
        new window.kakao.maps.Size(40, 40),
        { offset: new window.kakao.maps.Point(20, 40) }
      );

      const marker = new window.kakao.maps.Marker({
        map: mapRef.current as unknown as KakaoMap,
        position,
        image: markerImage,
      });

      newMarkers.push(marker);

      const content = document.createElement('div');
      content.className = 'custom-overlay-box';
      content.innerHTML = `
        <div class="custom-overlay">
          <button class="custom-close-btn" title="닫기">&times;</button>
          <div class="info-title">${place.place_name}</div>
          <div class="info-rating">${'★'.repeat(Math.round(place.overallRating)).padEnd(5, '☆')} (${place.overallRating.toFixed(1)})</div>
          ${
            place.keywords.length
              ? `<div class="info-keywords">${place.keywords.map((kw: string) => `<span>#${kw}</span>`).join(' ')}</div>`
              : ''
          }
          <a class="info-link" href="/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}">자세히 보기</a>
        </div>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        content,
        position,
        xAnchor: 0.5,
        yAnchor: 1.1,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        (mapRef.current as KakaoMap).panTo(position);
        if (currentOverlay) currentOverlay.setMap(null);
        overlay.setMap(mapRef.current as unknown as KakaoMap);
        currentOverlay = overlay;

        setTimeout(() => {
          const closeBtn = content.querySelector('.custom-close-btn');
          closeBtn?.addEventListener('click', () => overlay.setMap(null));
        }, 50);
      });
    });

    setMarkers(newMarkers);
  };

  const searchToilets = async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(
      '화장실',
      async (data: KakaoPlace[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        const enriched: EnrichedToilet[] = await Promise.all(
          data.map(async (place) => {
            try {
              const res = await fetch(`/api/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}`);
              if (!res.ok) throw new Error();
              const dbData: ToiletDbData = await res.json();
              return {
                ...place,
                overallRating: dbData.overallRating ?? 3,
                reviews: dbData.reviews ?? [],
                keywords: dbData.keywords ?? [],
              };
            } catch {
              return {
                ...place,
                overallRating: 3,
                reviews: [],
                keywords: [],
              };
            }
          })
        );

        setToiletList(
          enriched.map((toilet) => ({
            ...toilet,
            reviews: Array.isArray(toilet.reviews)
              ? toilet.reviews.filter(isValidReview)
              : [],
          }))
        );

        localStorage.setItem('toiletList', JSON.stringify(enriched));
        setAllToilets(enriched);
        renderMarkers(enriched);
      },
      {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 20000,
      }
    );
  };

  const filteredToilets = selectedFilters.length === 0
    ? allToilets
    : allToilets.filter((t) =>
        selectedFilters.every((kw) => t.keywords?.includes(kw))
      );

  useEffect(() => {
    if (mapRef.current) {
      renderMarkers(filteredToilets);
    }
  }, [selectedFilters]);

  return (
    <div className="map-wrapper">
      <Header />
      <div className="top-ui">
        <button
          className="toggle-filter-btn"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? '키워드 숨기기' : '키워드 보기'}
        </button>

        {showFilters && (
          <div className="keyword-filter">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`filter-btn ${selectedFilters.includes(filter) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFilters((prev) =>
                    prev.includes(filter)
                      ? prev.filter((f) => f !== filter)
                      : [...prev, filter]
                  );
                }}
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
