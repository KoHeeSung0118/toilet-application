'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import './CommentPage.css';

export default function CommentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const placeName = searchParams?.get('place_name') ?? '이름 미정';
  const from = searchParams?.get('from') ?? '';
  const toiletId = params && params.id ? (Array.isArray(params.id) ? params.id[0] : params.id) : undefined;

  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null); // 평균 별점 상태

  useEffect(() => {
    const fetchRating = async () => {
      if (!toiletId) return;
      try {
        const res = await fetch(`/api/toilet/${toiletId}/rating`);
        const data = await res.json();
        setAvgRating(data.avgRating);
      } catch (e) {
        console.error('평균 별점 불러오기 실패:', e);
      }
    };
    fetchRating();
  }, [toiletId]);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      alert('댓글을 입력하세요.');
      return;
    }

    if (!toiletId) {
      alert('화장실 ID가 없습니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/toilet/${toiletId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment: comment.trim() })
      });

      if (res.ok) {
        alert('댓글이 등록되었습니다.');
        router.replace(
          `/toilet/${toiletId}?place_name=${encodeURIComponent(placeName)}${
            from ? `&from=${from}` : ''
          }`
        );
        router.refresh();
      } else {
        const err = await res.json();
        alert(`댓글 등록 실패: ${err.message}`);
      }
    } catch (err) {
      console.error('댓글 등록 오류:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h2 className="title">{placeName}</h2>

      <div className="star-row">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            style={{
              color: i < Math.round(avgRating ?? 3) ? '#F5A623' : '#DDD',
              fontSize: '24px',
            }}
          >
            ★
          </span>
        ))}
      </div>

      <textarea
        className="comment-box"
        placeholder="댓글을 입력하세요"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? '등록 중...' : '등록 하기'}
      </button>

      <button
        className="back-btn"
        onClick={() =>
          router.replace(
            `/toilet/${toiletId}?place_name=${encodeURIComponent(placeName)}${
              from ? `&from=${from}` : ''
            }`
          )
        }
      >
        뒤로 가기
      </button>
    </div>
  );
}
