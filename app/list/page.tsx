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
            const rating =
              typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;

            // ✅ 최신 댓글 추출
            const latestComment =
              toilet.reviews
                ?.slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )[0]?.comment ?? '댓글 없음';

            return (
              <li className="modern-toilet-card" key={index}>
                <div className="card-left">
                  <Link
                    href={`/toilet/${toilet.id}?from=list`}
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
                  />
                  <div className="toilet-comment">{latestComment}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
