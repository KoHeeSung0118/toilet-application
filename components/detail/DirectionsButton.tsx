'use client';

import { useCallback } from 'react';

interface DirectionsButtonProps {
  placeName: string;
  lat: number | null;
  lng: number | null;
}

export default function DirectionsButton({ placeName, lat, lng }: DirectionsButtonProps) {
  /* 클릭 → 카카오맵 “도착지만” 링크 */
  const handleClick = useCallback(() => {
    if (lat == null || lng == null) {
      alert('목적지 좌표가 없습니다.');
      return;
    }

    const url = `https://map.kakao.com/link/to/${encodeURIComponent(
      placeName,
    )},${lat},${lng}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [placeName, lat, lng]);

  return (
    <button type="button" className="route-btn" onClick={handleClick}>
        길찾기
    </button>
  );
}
