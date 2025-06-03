// ✅ app/toilet/[id]/page.tsx
import './DetailPage.css';

interface Toilet {
  place_name: string;
  cleanliness?: number;
  facility?: number;
  convenience?: number;
  keywords?: string[];
  reviews?: { user: string; comment: string }[];
  overallRating?: number; // 평균 별점 필드 추가
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
}) {``
  const placeName = searchParams.place_name ?? '';

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/toilet/${params.id}?place_name=${encodeURIComponent(placeName)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) return <p>화장실 정보를 찾을 수 없습니다.</p>;

  const toilet: Toilet = await res.json();
  const encodedName = encodeURIComponent(toilet.place_name || '이름 없음');

  return (
    <div className="detail-page">
      <div className="header">
        <h2>{toilet.place_name || '이름 없음'}</h2>
        <div className="rating">
          {'★'.repeat(Math.round(toilet.overallRating || 0)).padEnd(5, '☆')} (
          {toilet.overallRating?.toFixed(1) ?? '0.0'})
        </div>
        <div className="btn-group">
          <a href={`/toilet/${params.id}/keywords?place_name=${encodedName}`}>키워드 추가하기</a>
          <a href={`/toilet/${params.id}/rate?place_name=${encodedName}`}>별점 추가하기</a>
        </div>
      </div>

      {/* 평점 → 해석 */}
      <div className="tags-box">
        <div>청결: {getRatingStatus(toilet.cleanliness)}</div>
        <div>시설: {getRatingStatus(toilet.facility)}</div>
        <div>편의: {getRatingStatus(toilet.convenience)}</div>
      </div>

      {/* 키워드 출력 */}
      {toilet.keywords?.length ? (
        <div className="keyword-box">
          {toilet.keywords.map((kw, idx) => (
            <span key={idx} className="tag">#{kw}</span>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: '1rem' }}>등록된 키워드가 없습니다.</p>
      )}

      {/* 리뷰 출력 */}
      <div className="reviews">
        {toilet.reviews?.length > 0 ? (
          toilet.reviews.map((review, idx) => (
            <p key={idx}>
              <strong>{review.user || '익명'}</strong>: {review.comment}
            </p>
          ))
        ) : (
          <p>아직 등록된 댓글이 없습니다.</p>
        )}
      </div>

      <a
        className="comment-btn"
        href={`/toilet/${params.id}/comment?place_name=${encodedName}`}
      >
        댓글 추가하기
      </a>
    </div>
  );
}
