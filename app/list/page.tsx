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
          {toiletList.map((toilet, index) => {
            const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
            return (
              <li className="toilet-card" key={index}>
                <div className="left-section">
                  <FavoriteButton toiletId={toilet.id} placeName={toilet.place_name} />
                </div>

                <div className="middle-section">
                  <div className="toilet-name">
                    <Link
                      href={`/toilet/${toilet.id}?from=list`}
                      className="toilet-name-link"
                    >
                      <strong>{toilet.place_name}</strong>
                    </Link>
                  </div>

                  <div className="toilet-rating">
                    <span className="star-colored">
                      {'★'.repeat(Math.round(rating)).padEnd(5, '☆')}
                    </span>{' '}
                    ({rating.toFixed(1)})
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
