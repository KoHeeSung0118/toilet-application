'use client';

import { useEffect, useState } from 'react';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import '../list/ToiletList.css';
import './FavoritePage.css';

interface Toilet {
  id: string;
  place_name: string;
  overallRating?: number;
  reviews?: {
    comment: string;
    [key: string]: any;
  }[];
}

export default function FavoritePage() {
  const [favorites, setFavorites] = useState<Toilet[]>([]);
  const [removingIds, setRemovingIds] = useState<string[]>([]);


  useEffect(() => {
    fetch('/api/favorite/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFavorites(data);
        } else {
          console.error('❌ favorites가 배열이 아닙니다:', data);
          setFavorites([]);
        }
      })
      .catch((err) => {
        console.error('❌ 즐겨찾기 불러오기 실패:', err);
      });
  }, []);

  const handleUnfavorite = (toiletId: string) => {
    setRemovingIds(prev => [...prev, toiletId]);
    setTimeout(() => {
      setFavorites(prev => prev.filter(t => t.id !== toiletId));
      setRemovingIds(prev => prev.filter(id => id !== toiletId));
    }, 400);
  };

  return (
    <div className="list-page">
      {favorites.length === 0 ? (
        <p>즐겨찾기한 화장실이 없습니다.</p>
      ) : (
        <ul className="toilet-list">
          {favorites.map((toilet) => {
            const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
            const comment = toilet.reviews?.[0]?.comment ?? '댓글 없음';

            return (
              <li
                className={`modern-toilet-card ${removingIds.includes(toilet.id) ? 'fade-out' : ''}`}
                key={toilet.id}
              >
                <div className="card-left">
                  <Link
                    href={`/toilet/${toilet.id}?from=favorites&place_name=${encodeURIComponent(toilet.place_name)}`}
                    className="toilet-name-link"
                  >
                    <div className="toilet-name">{toilet.place_name}</div>
                  </Link>
                  <div className="toilet-rating">
                    <span className="star">★</span> {rating.toFixed(1)}
                  </div>
                </div>

                <div className="card-right">
                  <FavoriteButton
                    toiletId={toilet.id}
                    placeName={toilet.place_name}
                    onUnfavorite={() => handleUnfavorite(toilet.id)}
                  />
                  <div className="toilet-comment">{comment}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
