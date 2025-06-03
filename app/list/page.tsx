// ✅ app/list/page.tsx
'use client';

import { useToilet } from '@/context/ToiletContext';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import Link from 'next/link';
import './ToiletList.css';

export default function ToiletListPage() {
  const { toiletList } = useToilet();

  return (
    <div className="list-page">
      {toiletList.length === 0 ? (
        <p>화장실을 불러오는 중입니다...</p>
      ) : (
        <ul className="toilet-list">
          {toiletList.map((toilet, index) => (
            <li className="toilet-card" key={index}>
              <div className="left-section">
                <FavoriteButton toiletId={toilet.id} placeName={toilet.place_name} />
              </div>
              <div className="middle-section">
                <div className="toilet-name">
                  <Link
                    href={`/toilet/${toilet.id}?place_name=${encodeURIComponent(
                      toilet.place_name
                    )}`}
                    className="toilet-name-link"
                  >
                    <strong>{toilet.place_name}</strong>
                  </Link>
                </div>
                <div className="toilet-rating">★★★★☆</div>
              </div>
              <div className="right-section">
                <div className="toilet-user">aaa-</div>
                <div className="toilet-comment">여기 화장실 그냥 그래요</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
