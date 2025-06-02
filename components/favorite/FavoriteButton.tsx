'use client';

import { useEffect, useState } from 'react';

interface FavoriteButtonProps {
  toiletId: string;
  toilet?: any;
}

export default function FavoriteButton({ toiletId, toilet }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!toiletId) return;

    const fetchFavoriteStatus = async () => {
      try {
        const res = await fetch(`/api/favorite/status?toiletId=${toiletId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        setIsFavorite(data.isFavorite);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteStatus();
  }, [toiletId]);

  const toggleFavorite = async () => {
    try {
      const res = await fetch('/api/favorite/toggle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, toilet }),
      });
      const data = await res.json();
      setIsFavorite(data.isFavorite);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <span className="favorite-icon">☆</span>;

  return (
    <span
      className={`favorite-icon ${isFavorite ? 'active' : ''}`}
      onClick={toggleFavorite}
    >
      {isFavorite ? '★' : '☆'}
    </span>
  );
}
