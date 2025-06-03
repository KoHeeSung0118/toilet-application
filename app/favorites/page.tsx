'use client';

import { useEffect, useState } from 'react';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import '../list/ToiletList.css';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorite/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setFavorites(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="list-page">
      {loading ? (
        <p>불러오는 중...</p>
      ) : favorites.length === 0 ? (
        <p>즐겨찾기한 화장실이 없습니다.</p>
      ) : (
        <ul className="toilet-list">
          {favorites.map((toilet, index) => (
            <li key={index} className="toilet-card">
              <div className="left-section">
                <FavoriteButton
                  toiletId={toilet.id}
                  placeName={toilet.place_name || '이름 없음'}
                />
              </div>
              <div className="middle-section">
                <div className="toilet-name">
                  <Link href={`/toilet/${toilet.id}`} className="toilet-name-link">
                    <strong>{toilet.place_name}</strong>
                  </Link>
                </div>
                <div className="toilet-rating">★★★★☆</div>
              </div>
              <div className="right-section">
                <div className="toilet-user">aaa-</div>
                <div className="toilet-comment">여기 화장실 좋아요</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}