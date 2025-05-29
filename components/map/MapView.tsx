'use client';

import { useEffect } from 'react';
import './MapView.css';
import { useToilet } from '@/context/ToiletContext';

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapView() {
  const { setToiletList } = useToilet();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        const loadMap = (latitude: number, longitude: number) => {
          const container = document.getElementById('map');
          const options = {
            center: new window.kakao.maps.LatLng(latitude, longitude),
            level: 3,
          };

          const map = new window.kakao.maps.Map(container, options);
          const ps = new window.kakao.maps.services.Places();
          ps.keywordSearch(
            '화장실',
            (data, status) => {
              if (status === window.kakao.maps.services.Status.OK) {
                setToiletList(data);
                let currentOverlay: any = null;

                data.forEach((place) => {
                  const marker = new window.kakao.maps.Marker({
                    map: map,
                    position: new window.kakao.maps.LatLng(place.y, place.x),
                  });

                  const content = `
  <div class="toilet-overlay-box">
    <div class="header">
      <span class="title">${place.place_name} - 200M</span>
      <span class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">X</span>
    </div>
    <div class="rating">
      <span class="filled">★★★★</span><span class="empty">☆</span>
    </div>
    <div class="tags">
      <span>#성별 분리</span> <span>#장애인 화장실O</span> <span>#비데있음</span> <span>#쾌적함</span>
    </div>
  </div>
`;


                  const overlay = new window.kakao.maps.CustomOverlay({
                    content: content,
                    position: new window.kakao.maps.LatLng(place.y, place.x),
                    yAnchor: 1.5,
                  });

                  window.kakao.maps.event.addListener(marker, 'click', () => {
                    if (currentOverlay) currentOverlay.setMap(null);
                    overlay.setMap(map);
                    currentOverlay = overlay;
                    setTimeout(() => {
                      const closeBtn = document.getElementById(`close-${place.id}`);
                      if (closeBtn) {
                        closeBtn.onclick = () => {
                          overlay.setMap(null);
                          currentOverlay = null;
                        };
                      }
                    }, 0);

                  });
                });
              }
            },
            {
              location: new window.kakao.maps.LatLng(latitude, longitude),
              radius: 20000,
            }
          );
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            loadMap(position.coords.latitude, position.coords.longitude);
          },
          () => {
            // 위치 못 가져왔을 때: 서울시청 기준
            loadMap(37.5665, 126.9780);
          }
        );
      });
    };
  }, []);

  return (
    <div className="map-wrapper">
      <div id="map" className="map-container" />
    </div>
  );
}
