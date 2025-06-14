'use client';

import { useEffect, useRef, useState } from 'react';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';
import { useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    kakao: any;
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
  '냄새 좋음'
];

export default function MapView() {
  const { setToiletList } = useToilet();
  const mapRef = useRef<any>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [allToilets, setAllToilets] = useState<any[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const queryKeyword = searchParams.get('query');

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

    mapRef.current = map;
    searchToilets(lat, lng);
  };

  const handleQuerySearch = (keyword: string) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        mapRef.current.setCenter(coords);
        searchToilets(result[0].y, result[0].x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  };

  const renderMarkers = (toilets: any[]) => {
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    let currentOverlay: any = null;
    const newMarkers: any[] = [];

    toilets.forEach((place) => {
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(place.y, place.x),
      });
      newMarkers.push(marker);

      const content = `
        <div class="toilet-overlay-box">
          <div class="header">
            <span class="title">${place.place_name}</span>
            <span class="close-btn" id="close-${place.id}">X</span>
          </div>
          <div class="rating" style="color: #f5a623; font-weight: bold;">
            ${'★'.repeat(Math.round(place.overallRating)).padEnd(5, '☆')} (${place.overallRating.toFixed(1)})
          </div>
          ${place.keywords.length
            ? `<div class="keywords">${place.keywords.map((kw: string) => `<span class="tag">#${kw}</span>`).join(' ')}</div>`
            : ''
          }
          <a href="/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}" class="detail-link">자세히 보기</a>
        </div>
      `;

      const overlay = new window.kakao.maps.CustomOverlay({
        content,
        position: new window.kakao.maps.LatLng(place.y, place.x),
        yAnchor: 1.5,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        mapRef.current.panTo(marker.getPosition());
        if (currentOverlay) currentOverlay.setMap(null);
        overlay.setMap(mapRef.current);
        currentOverlay = overlay;

        setTimeout(() => {
          const closeBtn = document.getElementById(`close-${place.id}`);
          if (closeBtn) closeBtn.onclick = () => overlay.setMap(null);
        }, 0);
      });
    });

    setMarkers(newMarkers);
  };

  const searchToilets = async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        const enriched = await Promise.all(
          data.map(async (place) => {
            try {
              const res = await fetch(`/api/toilet/${place.id}?place_name=${encodeURIComponent(place.place_name)}`);
              if (!res.ok) throw new Error();
              const dbData = await res.json();
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

        setToiletList(enriched);
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
      <div className="top-ui">
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
      </div>

      <div id="map" className="map-container" />
    </div>
  );
}