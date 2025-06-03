// app/toilet/[id]/keywords/page.tsx

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './KeywordPage.css';

const KEYWORDS = ['화장실 비데', '장애인 화장실', '성별 분리', '비데 설치', '휴지 많음', '물 잘나옴', '냄새 좋음'];

export default function KeywordPage({ params }: { params: { id: string } }) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeName = searchParams.get('place_name') ?? '이름 미정';

  const toggleKeyword = (word: string) => {
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  const handleSubmit = async () => {
    const res = await fetch(`/api/toilet/${params.id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: selected }),
    });

    if (res.ok) {
      router.back();
    } else {
      alert('등록 실패');
    }
  };

  return (
    <div className="keyword-page">
      <h2 className="title">{placeName}</h2>
      <div className="keyword-list">
        {KEYWORDS.map((word, i) => (
          <button
            key={i}
            className={`keyword ${selected.includes(word) ? 'selected' : ''}`}
            onClick={() => toggleKeyword(word)}
          >
            {word}
          </button>
        ))}
      </div>

      <button className="submit-btn" onClick={handleSubmit}>등록 하기</button>
      <button className="back-btn" onClick={() => router.back()}>뒤로 가기</button>
    </div>
  );
}
