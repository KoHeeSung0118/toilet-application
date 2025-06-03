'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './CommentPage.css';

export default function CommentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeName = searchParams.get('place_name') ?? '이름 미정';

  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      alert('댓글을 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/toilet/${params.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: '익명',
          comment,
        }),
      });

      if (res.ok) {
        alert('댓글이 등록되었습니다.');
        router.back();
      } else {
        alert('댓글 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('댓글 등록 오류:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="comment-page">
      <h2 className="title">{placeName}</h2>

      <div className="star-row">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            style={{
              color: i < 3 ? '#6AA0BD' : '#C7EBFF',
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
      <button className="back-btn" onClick={() => router.back()}>
        뒤로 가기
      </button>
    </div>
  );
}
