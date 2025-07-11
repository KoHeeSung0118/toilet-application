/* eslint-disable @typescript-eslint/no-explicit-any */
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
  reviews?: unknown[];
  keywords?: string[];
}

interface EnrichedToilet extends KakaoPlace {
  overallRating: number;
  reviews: unknown[];
  keywords: string[];
}

export default function MapView() {
  const { setToiletList } = useToilet();
  const mapRef = useRef<any>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<EnrichedToilet[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchParams = useSearchParams();
  const queryKeyword = searchParams?.get('query');

  const initMap = useCallback((lat: number, lng: number) => {
    const container = document.getElementById('map');
    if (!container) return;

    const map = new window.kakao.maps.Map(container, {
      center: new window.kakao.maps.LatLng(lat, lng),
      level: 3,
    });

    mapRef.current = map;
    searchToilets(lat, lng);
  }, []);

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
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=발급받은키&autoload=false&libraries=services`;
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

  const renderMarkers = useCallback((toilets: EnrichedToilet[]) => {
    markers.forEach((marker) => marker.setMap(null));
    setMarkers([]);

    let currentOverlay: any = null;
    const newMarkers: any[] = [];

    toilets.forEach((place) => {
      const position = new window.kakao.maps.LatLng(place.y, place.x);
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current!,
        position,
        image: new window.kakao.maps.MarkerImage('/marker/toilet-icon.png', new window.kakao.maps.Size(40, 40)),
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

    setMarkers(newMarkers);
  }, [markers]);

  const searchToilets = async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch('화장실', async (data, status) => {
      if (status !== window.kakao.maps.services.Status.OK) return;

      const enriched: EnrichedToilet[] = await Promise.all(
        data.map(async (place: KakaoPlace) => {
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
  };

  const filteredToilets = selectedFilters.length === 0
    ? allToilets
    : allToilets.filter((t) => selectedFilters.every((kw) => t.keywords.includes(kw)));

  useEffect(() => {
    if (mapRef.current) renderMarkers(filteredToilets);
  }, [filteredToilets, renderMarkers]);

  return (
    <div className="map-wrapper">
      <Header />
      <div className="top-ui">
        <button className="toggle-filter-btn" onClick={() => setShowFilters((prev) => !prev)}>
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
                    prev.includes(filter)
      <div id="map" className="map-container" />
    </div>
  );
}
