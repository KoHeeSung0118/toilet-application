'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './CommentPage.css';

export default function CommentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeName = searchParams.get('place_name') ?? '이름 미정';

  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    console.log('📝 댓글 내용:', comment);
    // TODO: POST 요청으로 서버에 전송
    router.back();
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

      <button className="submit-btn" onClick={handleSubmit}>등록 하기</button>
      <button className="back-btn" onClick={() => router.back()}>뒤로 가기</button>
    </div>
  );
}
