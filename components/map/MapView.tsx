'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Header from '@/components/common/Header';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import { useSearchParams } from 'next/navigation';

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

export default function MapView() {
  const { setToiletList } = useToilet();
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<EnrichedToilet[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchParams = useSearchParams();
  const queryKeyword = searchParams?.get('query');

  const renderMarkers = useCallback((toilets: EnrichedToilet[]) => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    let currentOverlay: kakao.maps.CustomOverlay | null = null;
    const newMarkers: kakao.maps.Marker[] = [];

    toilets.forEach((place) => {
      const position = new window.kakao.maps.LatLng(Number(place.y), Number(place.x));
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current!,
        position,
        image: new window.kakao.maps.MarkerImage(
          '/marker/toilet-icon.png',
          new window.kakao.maps.Size(40, 40),
        ),
      });

      newMarkers.push(marker);

      const content = document.createElement('div');
      content.className = 'custom-overlay-box';
      content.innerHTML = `
        <div class="custom-overlay">
          <button class="custom-close-btn">&times;</button>
          <div class="info-title">${place.place_name}</div>
          <div class="info-rating">★ ${place.overallRating.toFixed(1)}</div>
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
        mapRef.current?.panTo(position);
        currentOverlay?.setMap(null);
        overlay.setMap(mapRef.current);
        currentOverlay = overlay;

        setTimeout(() => {
          content.querySelector('.custom-close-btn')?.addEventListener('click', () => {
            overlay.setMap(null);
          });
        }, 50);
      });
    });

    markersRef.current = newMarkers;
  }, []);

  const searchToilets = useCallback(async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch('화장실', async (data: KakaoPlace[], status: kakao.maps.services.Status) => {
      if (status !== window.kakao.maps.services.Status.OK) return;

      const enriched: EnrichedToilet[] = await Promise.all(
        data.map(async (place) => {
          try {
            const res = await fetch(`/api/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}`);
            const dbData: ToiletDbData = await res.json();
            return {
              ...place,
              overallRating: dbData.overallRating ?? 3,
              reviews: dbData.reviews ?? [],
              keywords: dbData.keywords ?? [],
            };
          } catch {
            return { ...place, overallRating: 3, reviews: [], keywords: [] };
          }
        })
      );

      setToiletList(enriched);
      localStorage.setItem('toiletList', JSON.stringify(enriched));
      setAllToilets(enriched);
      renderMarkers(enriched);
    }, {
      location: new window.kakao.maps.LatLng(lat, lng),
      radius: 20000,
    });
  }, [renderMarkers, setToiletList]);

  const initMap = useCallback((lat: number, lng: number) => {
    const container = document.getElementById('map');
    if (!container) return;

    const map = new window.kakao.maps.Map(container, {
      center: new window.kakao.maps.LatLng(lat, lng),
      level: 3,
    });

    mapRef.current = map;
    searchToilets(lat, lng);
  }, [searchToilets]);

  const handleQuerySearch = useCallback((keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const coords = new window.kakao.maps.LatLng(Number(result[0].y), Number(result[0].x));
        mapRef.current?.setCenter(coords);
        searchToilets(Number(result[0].y), Number(result[0].x));
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  }, [searchToilets]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            initMap(pos.coords.latitude, pos.coords.longitude);
            if (queryKeyword) handleQuerySearch(queryKeyword);
          },
          () => {
            initMap(37.5665, 126.9780);
            if (queryKeyword) handleQuerySearch(queryKeyword);
          }
        );
      });
    };
  }, [handleQuerySearch, initMap, queryKeyword]);

  const filteredToilets = selectedFilters.length === 0
    ? allToilets
    : allToilets.filter((t) =>
        selectedFilters.every((kw) => t.keywords.includes(kw))
      );

  useEffect(() => {
    if (mapRef.current) {
      renderMarkers(filteredToilets);
    }
  }, [filteredToilets, renderMarkers]);

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
                onClick={() =>
                  setSelectedFilters((prev) =>
                    prev.includes(filter)
                      ? prev.filter((f) => f !== filter)
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
