'use client';

import { useEffect, useState } from 'react';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import '../list/ToiletList.css';
import './FavoritePage.css'; // ✅ 새 CSS 추가

export default function FavoritePage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [removingIds, setRemovingIds] = useState<string[]>([]); // ✅ 제거 중인 항목 추적

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
    }, 400); // ✅ 애니메이션 후 제거
  };

  return (
    <div className="list-page">
      {favorites.length === 0 ? (
        <p>즐겨찾기한 화장실이 없습니다.</p>
      ) : (
        <ul className="toilet-list">
          {favorites.map((toilet) => (
            <li
              className={`toilet-card ${removingIds.includes(toilet.id) ? 'fade-out' : ''}`}
              key={toilet.id}
            >
              <div className="left-section">
                <FavoriteButton
                  toiletId={toilet.id}
                  placeName={toilet.place_name}
                  onUnfavorite={() => handleUnfavorite(toilet.id)} // ✅ 콜백 전달
                />
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
