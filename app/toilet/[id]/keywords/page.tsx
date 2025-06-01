'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './KeywordPage.css';

const KEYWORDS = [
  '화장실 비데',
  '장애인 화장실',
  '성별 분리',
  '비데 설치',
  '휴지 많음',
  '물 잘나옴',
  '냄새 좋음',
];

export default function KeywordPage({ params }: { params: { id: string } }) {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  const toggleKeyword = (word: string) => {
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );
  };

  const handleSubmit = () => {
    console.log('선택된 키워드:', selected);
    // 나중엔 fetch(`/api/toilet/${params.id}/keywords`, { method: 'POST', body: ... })
    router.back(); // 일단 뒤로 가기
  };

  return (
    <div className="keyword-page">
      <h2 className="title">a화장실</h2>
      <div className="rating">★★★☆☆</div>

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
