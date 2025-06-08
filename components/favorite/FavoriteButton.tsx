'use client';

import { useEffect, useState } from 'react';
import '../../app/list/ToiletList.css';

interface FavoriteButtonProps {
  toiletId: string;
  placeName: string;
  onUnfavorite?: () => void; // ✅ 콜백 추가
}

export default function FavoriteButton({ toiletId, placeName, onUnfavorite }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  // 즐겨찾기 상태 불러오기
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/favorite/status?toiletId=${toiletId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        setIsFavorite(data.isFavorite);
      } catch (e) {
        console.error('즐겨찾기 상태 확인 실패:', e);
      }
    };

    fetchStatus();
  }, [toiletId]);

  // 즐겨찾기 토글
  const handleToggle = async () => {
    try {
      const res = await fetch('/api/favorite/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toiletId,
          toilet: { id: toiletId, place_name: placeName },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setIsFavorite(result.isFavorite);

        // ✅ 해제된 경우 onUnfavorite 콜백 호출
        if (!result.isFavorite && onUnfavorite) {
          onUnfavorite();
        }
      } else {
        const error = await res.text();
        console.error('❌ 즐겨찾기 처리 실패:', error);
      }
    } catch (e) {
      console.error('서버 오류:', e);
    }
  };

  return (
    <button
      className={`favorite-icon ${isFavorite ? 'active' : ''}`}
      onClick={handleToggle}
      aria-label={isFavorite ? '즐겨찾기 취소' : '즐겨찾기 추가'}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}
