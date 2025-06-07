'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import './CommentPage.css';

export default function CommentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();

  const placeName = searchParams.get('place_name') ?? '이름 미정';
  const toiletId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit 실행됨');
    console.log('📝 comment:', comment);
    console.log('🆔 toiletId:', toiletId);

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
        router.back();
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
          <span key={i} style={{ color: i < 3 ? '#F5A623' : '#DDD', fontSize: '24px' }}>★</span>
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
