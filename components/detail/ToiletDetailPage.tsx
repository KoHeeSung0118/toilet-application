'use client';

import './DetailPage.css';
import DeleteCommentButton from './DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from './ClientOnlyBackButton';
import DirectionsButton from '@/components/detail/DirectionsButton';

/* --------------------------------------------------------
 * 타입 정의 (MongoDB _id 유지)
 * ------------------------------------------------------*/
interface Toilet {
  _id: string;           // MongoDB ObjectId 그대로 보존
  place_name: string;
  lat: number;           // 위도 (number)
  lng: number;           // 경도 (number)
  keywords?: string[];
  reviews?: {
    _id: string;
    userId: string;
    nickname: string;
    comment: string;
    createdAt: string | Date;
  }[];
  cleanliness?: number;
  facility?: number;
  convenience?: number;
  overallRating?: number;
}

interface ToiletDetailPageProps {
  id: string;                   // 카카오 place id (URL 세그먼트)
  placeName?: string;
  from?: string;
  currentUserId: string | null;
  toilet: Toilet;
}

export default function ToiletDetailPage({
  id,
  placeName = '',
  from = '',
  currentUserId,
  toilet,
}: ToiletDetailPageProps) {
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(placeName || toilet.place_name || '');


  return (
    <div className="detail-page">
      <ClientOnlyBackButton />

      {/* 헤더 */}
      <div className="detail-header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name}</h2>
        <div className="rating">
          {'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="btn-group">
          <a href={`/toilet/${id}/keywords?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
            키워드 추가하기
          </a>
          <a href={`/toilet/${id}/rate?place_name=${encodedName}${from ? `&from=${from}` : ''}`}>
            별점 추가하기
          </a>
          {/* 🚗 길찾기 버튼 */}
          <DirectionsButton
            placeName={toilet.place_name}
            lat={toilet.lat}
            lng={toilet.lng}
          />
        </div>
      </div>

      {/* 태그 상태 */}
      <div className="tags-box">
        사용자들의 평균 점수
        <div>청결: {toilet.cleanliness}점</div>
        <div>시설: {toilet.facility}점</div>
        <div>편의: {toilet.convenience}점</div>
      </div>

      {/* 키워드 */}
      {toilet.keywords?.length ? (
        <div className="keyword-box">
          {toilet.keywords.map((kw, idx) => (
            <span key={idx} className="tag">#{kw}</span>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
      )}

      {/* 댓글 */}
      <div className="reviews">
        <h3>댓글</h3>
        {toilet.reviews?.length ? (
          toilet.reviews
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((r) => (
              <div key={r._id} className="comment-item">
                <div className="comment-content">
                  <span>
                    <strong className="nickname">{r.nickname}</strong>: {r.comment}
                  </span>
                  {r.userId === currentUserId && (
                    <DeleteCommentButton toiletId={id} commentId={r._id} />
                  )}
                </div>
              </div>
            ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      {/* 댓글 작성 버튼 */}
      <a
        className="comment-btn"
        href={`/toilet/${id}/comment?place_name=${encodedName}${from ? `&from=${from}` : ''}`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
