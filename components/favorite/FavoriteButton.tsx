'use client';

import { useEffect, useState } from 'react';
import '../../app/list/ToiletList.css';

interface Props {
  toiletId: string;
  placeName: string; // 반드시 제공돼야 함
}

export default function FavoriteButton({ toiletId, placeName }: Props) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetch(`/api/favorite/status?toiletId=${toiletId}`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => seWtIsFavorite(data.isFavorite));
  }, [toiletId]);

  const toggleFavorite = async () => {
    const res = await fetch('/api/favorite/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        toiletId,
        toilet: {
          id: toiletId,
          place_name: placeName,
        },
      }),
    });

    if (res.ok) {
      const result = await res.json();
      setIsFavorite(result.isFavorite);
    }
  };

  return (
    <button
      className={`favorite-icon ${isFavorite ? 'active' : ''}`}
      onClick={toggleFavorite}
    >
      {isFavorite ? '★' : '☆'}
    </button>
  );
}