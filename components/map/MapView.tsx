'use client';

import { useEffect } from 'react';
import './MapView.css';

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapView() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=a138b3a89e633c20573ab7ccb1caca22&autoload=false&libraries=services`
    script.async = true;

    document.head.appendChild(script);

    script.onload = () => {
      window.kakao.maps.load(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const container = document.getElementById('map');
            const options = {
              center: new window.kakao.maps.LatLng(latitude, longitude),
              level: 4,
            };

            const map = new window.kakao.maps.Map(container, options);
            const ps = new window.kakao.maps.services.Places()
            ps.keywordSearch('화장실', (data, status) => {
              if (status === window.kakao.maps.services.Status.OK) {
                data.forEach((place) => {
                  const marker = new window.kakao.maps.Marker({
                    map: map,
                    position: new window.kakao.maps.LatLng(place.y, place.x),
                  })

                  const infowindow = new window.kakao.maps.InfoWindow({
                    content: `<div style="padding:5px;font-size:14px;">${place.place_name}</div>`,
                  })

                  window.kakao.maps.event.addListener(marker, 'click', () => {
                    infowindow.open(map, marker)
                  })
                })
              }
            }, {
              location: new kakao.maps.LatLng(latitude, longitude),
              radius: 20000
            })

          },
          (error) => {
            console.error("위치 가져오기 실패:", error);
            const container = document.getElementById('map');
            const options = {
              center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 기준 좌표
              level: 3,
            };

            const map = new window.kakao.maps.Map(container, options);
            const ps = new window.kakao.maps.services.Places()
            ps.keywordSearch('공중화장실', (data, status) => {
              if (status === window.kakao.maps.services.Status.OK) {
                data.forEach((place) => {
                  const marker = new window.kakao.maps.Marker({
                    map: map,
                    position: new window.kakao.maps.LatLng(place.y, place.x),
                  })

                  const infowindow = new window.kakao.maps.InfoWindow({
                    content: `<div style="padding:5px;font-size:14px;">${place.place_name}</div>`,
                  })

                  window.kakao.maps.event.addListener(marker, 'click', () => {
                    infowindow.open(map, marker)
                  })
                })
              }
            })

          }
        );
      });
    };
  }, []);

  return (
    <div id="map" style={{ width: '100%', height: '500px' }}></div>
  );
}
