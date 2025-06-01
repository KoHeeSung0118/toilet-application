'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './CommentPage.css';

export default function CommentPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  // 평균 별점 (예시)
  const averageRating = 3.6;

  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    console.log('📝 댓글 내용:', comment);
    // 추후: fetch(`/api/toilet/${params.id}/comment`, { method: 'POST', body: JSON.stringify({ comment }) })
    router.back();
  };

  return (
    <div className="comment-page">
      <h2 className="title">a화장실</h2>

      <div className="star-row">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            style={{
              color: i < Math.round(averageRating) ? '#6AA0BD' : '#C7EBFF',
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

      <button className="submit-btn" onClick={handleSubmit}>등록 하기</button>
      <button className="back-btn" onClick={() => router.back()}>뒤로 가기</button>
    </div>
  );
}
