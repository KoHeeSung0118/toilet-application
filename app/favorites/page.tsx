'use client';

import { useEffect, useState } from 'react';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import '../list/ToiletList.css';

export default function FavoritePage() {
  const [favorites, setFavorites] = useState<any[]>([]); // ✅ any[] 타입 지정

  useEffect(() => {
    fetch('/api/favorite/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFavorites(data);
        } else {
          console.error('❌ favorites가 배열이 아닙니다:', data);
          setFavorites([]); // 안전 처리
        }
      })
      .catch((err) => {
        console.error('❌ 즐겨찾기 불러오기 실패:', err);
      });
  }, []);

  return (
    <div className="list-page">
      {favorites.length === 0 ? (
        <p>즐겨찾기한 화장실이 없습니다.</p>
      ) : (
        <ul className="toilet-list">
          {favorites.map((toilet, index) => (
            <li className="toilet-card" key={index}>
              <div className="left-section">
                <FavoriteButton toiletId={toilet.id} placeName={toilet.place_name} />
              </div>
              <div className="middle-section">
                <div className="toilet-name">
                  <Link
                    href={`/toilet/${toilet.id}?place_name=${encodeURIComponent(toilet.place_name)}`}
                    className="toilet-name-link"
                  >
                    <strong>{toilet.place_name}</strong>
                  </Link>
                </div>
                <div className="toilet-rating">
                  <span className="star-colored">
                    {'★'.repeat(Math.round(toilet.overallRating ?? 3)).padEnd(5, '☆')}
                  </span>{' '}
                  ({(toilet.overallRating ?? 3).toFixed(1)})
                </div>
              </div>
              <div className="right-section">
                <div className="toilet-user">{toilet.reviews?.[0]?.user ?? '익명'}</div>
                <div className="toilet-comment">{toilet.reviews?.[0]?.comment ?? '댓글 없음'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
