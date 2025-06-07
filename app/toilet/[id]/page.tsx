import './DetailPage.css';
import DeleteCommentButton from '@/components/detail/DeleteCommentButton';
import FavoriteButton from '@/components/favorite/FavoriteButton';
import ClientOnlyBackButton from '@/components/detail/ClientOnlyBackButton';
import { getUserIdFromToken } from '@/lib/getUserIdFromToken';

interface Toilet {
  _id: string;
  place_name: string;
  keywords?: string[];
  reviews?: {
    _id: string;
    userId: string;
    nickname: string;
    comment: string;
  }[];
  cleanliness?: number;
  facility?: number;
  convenience?: number;
  overallRating?: number;
}

const getRatingStatus = (score?: number): string => {
  if (score === undefined || score === null) return '정보 없음';
  if (score >= 4) return '좋음';
  if (score >= 2.5) return '보통';
  return '나쁨';
};

export default async function ToiletDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { place_name?: string };
}) {
  const placeName = searchParams.place_name ?? '';
  const currentUserId = await getUserIdFromToken();

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/toilet/${params.id}?place_name=${encodeURIComponent(placeName)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) {
    return <p>화장실 정보를 찾을 수 없습니다.</p>;
  }

  const toilet: Toilet = await res.json();
  const rating = typeof toilet.overallRating === 'number' ? toilet.overallRating : 3;
  const encodedName = encodeURIComponent(toilet.place_name || '이름 없음');

  return (
    <div className="detail-page">
      <ClientOnlyBackButton />

      <div className="header">
        <div className="favorite-wrapper">
          <FavoriteButton toiletId={params.id} placeName={toilet.place_name} />
        </div>
        <h2>{toilet.place_name || '이름 없음'}</h2>
        <div className="rating">
          {'★'.repeat(Math.round(rating)).padEnd(5, '☆')} ({rating.toFixed(1)})
        </div>
        <div className="btn-group">
          <a href={`/toilet/${params.id}/keywords?place_name=${encodedName}`}>키워드 추가하기</a>
          <a href={`/toilet/${params.id}/rate?place_name=${encodedName}`}>별점 추가하기</a>
        </div>
      </div>

      <div className="tags-box">
        <div>청결: {getRatingStatus(toilet.cleanliness)}</div>
        <div>시설: {getRatingStatus(toilet.facility)}</div>
        <div>편의: {getRatingStatus(toilet.convenience)}</div>
      </div>

      {toilet.keywords?.length ? (
        <div className="keyword-box">
          {toilet.keywords.map((kw, idx) => (
            <span key={idx} className="tag">#{kw}</span>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
      )}

      {/* ✅ 댓글 출력 */}
      <div className="reviews">
        <h3>댓글</h3>
        {toilet.reviews?.length > 0 ? (
          toilet.reviews.map((review) => (
            <div key={review._id} className="comment-item">
              <div className="comment-content">
                <span>
                  <strong>{review.nickname}</strong>: {review.comment}
                </span>
                {review.userId === currentUserId && (
                  <DeleteCommentButton toiletId={params.id} commentId={review._id} />
                )}
              </div>
            </div>
          ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      <a className="comment-btn" href={`/toilet/${params.id}/comment?place_name=${encodedName}`}>
        댓글 추가하기
      </a>
    </div>
  );
}
