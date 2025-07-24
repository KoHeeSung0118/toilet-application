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
  _id: string;
  place_name: string;
  lat: number;
  lng: number;
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
  id: string;
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
  const rating =
    typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(
    placeName || toilet.place_name || ''
  );

  // 몇 초/분/시간/일/개월/년 전 형식으로 변환
  const formatTimeAgo = (date: string | Date) => {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return `${diffSec}초 전`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}일 전`;

    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}개월 전`;

    const diffYear = Math.floor(diffDay / 365);
    return `${diffYear}년 전`;
  };

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
          <a
            href={`/toilet/${id}/keywords?place_name=${encodedName}${
              from ? `&from=${from}` : ''
            }`}
          >
            키워드 추가하기
          </a>
          <a
            href={`/toilet/${id}/rate?place_name=${encodedName}${
              from ? `&from=${from}` : ''
            }`}
          >
            별점 추가하기
          </a>
          <DirectionsButton
            placeName={toilet.place_name}
            lat={toilet.lat}
            lng={toilet.lng}
          />
        </div>
      </div>

      {/* 사용자들의 평균 점수 */}
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
            <span key={idx} className="tag">
              #{kw}
            </span>
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
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((r) => (
              <div key={r._id} className="comment-item">
                <div className="comment-content">
                  <strong className="nickname">{r.nickname}</strong>:{' '}
                  <span className="comment-text">{r.comment}</span>

                  {/* 작성 시간 */}
                  <span className="comment-date">
                    {formatTimeAgo(r.createdAt)}
                  </span>

                  {r.userId === currentUserId && (
                    <DeleteCommentButton
                      toiletId={id}
                      commentId={r._id}
                    />
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
        href={`/toilet/${id}/comment?place_name=${encodedName}${
          from ? `&from=${from}` : ''
        }`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
