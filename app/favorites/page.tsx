'use client';

import { useToilet } from '@/context/ToiletContext';
import '../list/ToiletList.css'; // 같은 디자인 재사용

export default function FavoritesPage() {
  const { favorites } = useToilet();

  return (
    <div className="list-page">
      <ul className="toilet-list">
        {favorites.length === 0 ? (
          <p>즐겨찾기한 화장실이 없습니다.</p>
        ) : (
          favorites.map((toilet, index) => (
            <li key={index} className="toilet-card">
              <div className="left-section">
                <div className="favorite-icon">★</div>
              </div>
              <div className="middle-section">
                <div className="toilet-name"><strong>{toilet.place_name}</strong></div>
                <div className="toilet-rating">★★★★★</div>
              </div>
              <div className="right-section">
                <div className="toilet-user">aaa-</div>
                <div className="toilet-comment">여기 화장실 좋아요</div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
