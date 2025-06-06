'use client';

import { useEffect, useRef, useState } from 'react';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapView() {
  const { setToiletList } = useToilet();
  const mapRef = useRef<any>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

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
          },
          () => {
            initMap(37.5665, 126.9780); // 기본 위치: 서울시청
          }
        );
      });
    };
  }, []);

  const initMap = (lat: number, lng: number) => {
    const container = document.getElementById('map');
    const map = new window.kakao.maps.Map(container, {
      center: new window.kakao.maps.LatLng(lat, lng),
      level: 3,
    });

    mapRef.current = map;
    searchToilets(lat, lng);
  };

  const searchToilets = async (lat: number, lng: number) => {
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(
      '화장실',
      async (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) return;

        // 🔄 각 화장실에 대해 MongoDB에서 정보 보강
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
              };
            } catch (e) {
              return {
                ...place,
                overallRating: 3,
                reviews: [],
              };
            }
          })
        );

        setToiletList(enriched);

        // 🔽 오버레이 생성
        let currentOverlay: any = null;
        enriched.forEach((place) => {
          const marker = new window.kakao.maps.Marker({
            map: mapRef.current,
            position: new window.kakao.maps.LatLng(place.y, place.x),
          });

          const content = `
            <div class="toilet-overlay-box">
              <div class="header">
                <span class="title">${place.place_name}</span>
                <span class="close-btn" id="close-${place.id}">X</span>
              </div>
              <div class="rating">
                ${'★'.repeat(Math.round(place.overallRating)).padEnd(5, '☆')} (${place.overallRating.toFixed(1)})
              </div>
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
              if (closeBtn) {
                closeBtn.onclick = () => overlay.setMap(null);
              }
            }, 0);
          });
        });
      },
      {
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: 20000,
      }
    );
  };

  const handleSearch = () => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(searchKeyword, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        mapRef.current.setCenter(coords);
        searchToilets(result[0].y, result[0].x);
      } else {
        alert('검색 결과가 없습니다.');
      }
    });
  };

  return (
    <div className="map-wrapper">
      <div className="search-bar">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="장소 또는 주소 검색"
        />
        <button onClick={handleSearch}>검색</button>
      </div>
      <div id="map" className="map-container" />
    </div>
  );
}
