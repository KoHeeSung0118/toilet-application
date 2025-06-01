// 파일: app/toilet/[id]/page.tsx
import './ToiletDetailPage.css';

interface Toilet {
  place_name: string;
  cleanliness?: string;
  facility?: string;
  convenience?: string;
  reviews?: { user: string; comment: string }[];
}

export default async function ToiletDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { place_name?: string };
}) {
  const placeName = searchParams.place_name ?? '';

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/toilet/${params.id}?place_name=${encodeURIComponent(placeName)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) return <p>화장실 정보를 찾을 수 없습니다.</p>;

  const toilet: Toilet = await res.json();

  return (
    <div className="detail-page">
      <div className="header">
        <h2>{toilet.place_name || '이름 없음'}</h2>
        <div className="rating">★★★★☆</div>
        <div className="btn-group">
          <a href={`/toilet/${params.id}/keywords`}>키워드 추가하기</a>
          <a href={`/toilet/${params.id}/rate`}>별점 추가하기</a>
        </div>
      </div>

      <div className="tags-box">
        <div>청결: {toilet.cleanliness || '정보 없음'}</div>
        <div>시설: {toilet.facility || '정보 없음'}</div>
        <div>편의: {toilet.convenience || '정보 없음'}</div>
      </div>

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

      <a className="comment-btn" href={`/toilet/${params.id}/comment`}>
        댓글 추가하기
      </a>
    </div>
  );
}
