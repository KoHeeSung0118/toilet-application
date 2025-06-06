'use client';

import { useEffect, useState } from 'react';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import '../list/ToiletList.css'; // 기존 스타일 재사용

export default function FavoritePage() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetch('/api/favorite/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setFavorites(data));
  }, []);

  return (
    <div className="list-page"> {/* ✅ className 통일 */}
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
                  {'★'.repeat(Math.round(toilet.overallRating ?? 3)).padEnd(5, '☆')} (
                  {(toilet.overallRating ?? 3).toFixed(1)})
                </div>
              </div>

              <div className="right-section">
                <div className="toilet-user">
                  {toilet.reviews?.[0]?.user ?? '익명'}
                </div>
                <div className="toilet-comment">
                  {toilet.reviews?.[0]?.comment ?? '댓글 없음'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
