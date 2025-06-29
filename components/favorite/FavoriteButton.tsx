'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import '../../app/list/ToiletList.css';

interface FavoriteButtonProps {
  toiletId: string;
  placeName: string;
  onUnfavorite?: () => void;
}

export default function FavoriteButton({
  toiletId,
  placeName,
  onUnfavorite,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);

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
        if (!result.isFavorite && onUnfavorite) onUnfavorite();
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
      onClick={handleToggle}
      className="favorite-button"
      aria-label={isFavorite ? '즐겨찾기 취소' : '즐겨찾기 추가'}
    >
      <Heart
        className="heart-icon"
        stroke={isFavorite ? '#4E3CDB' : '#4E3CDB'}
        fill={isFavorite ? '#4E3CDB' : 'none'}
        size={20}
      />
    </button>
  );
}
