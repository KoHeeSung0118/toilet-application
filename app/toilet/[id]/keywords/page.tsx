'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import './KeywordPage.css';

const KEYWORDS = [
  '화장실 칸 많음', '화장실 칸 적음', '장애인 화장실', '성별 분리',
  '비데 설치 되어있음', '휴지 많음', '물 잘나옴', '냄새 좋음'
];

export default function KeywordPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [isEdit, setIsEdit] = useState(false);        // ← 추가
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const id = params?.id as string;
  const placeName = searchParams?.get('place_name') ?? '이름 미정';
  const from = searchParams?.get('from') ?? '';

  /* 1) 최초 키워드 읽기 */
  useEffect(() => {
    const fetchKeywords = async () => {
      const res = await fetch(`/api/toilet/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.keywords) && data.keywords.length > 0) {
        setSelected(data.keywords);
        setIsEdit(true);                              // ← 이미 값이 있으면 수정 모드
      }
    };
    if (id) fetchKeywords();
  }, [id]);

  /* 2) 토글 */
  const toggleKeyword = (word: string) =>
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    );

  /* 3) 저장 */
  const handleSubmit = async () => {
    const res = await fetch(`/api/toilet/${id}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: selected })
    });

    if (res.ok) {
      router.replace(
        `/toilet/${id}?place_name=${encodeURIComponent(placeName)}${
          from ? `&from=${from}` : ''
        }`
      );
      router.refresh();
    } else {
      alert('등록 실패');
    }
  };

  /* 4) 렌더 */
  return (
    <div className="page-container">
      <h2 className="title">{placeName}</h2>

      <div className="keyword-list">
        {KEYWORDS.map((word) => (
          <button
            key={word}
            className={`keyword ${selected.includes(word) ? 'selected' : ''}`}
            onClick={() => toggleKeyword(word)}
          >
            {word}
          </button>
        ))}
      </div>

      {/* 버튼 문구만 isEdit에 따라 변경 */}
      <button className="submit-btn" onClick={handleSubmit}>
        {isEdit ? '수정 하기' : '등록 하기'}
      </button>

      <button
        className="back-btn"
        onClick={() =>
          router.replace(
            `/toilet/${id}?place_name=${encodeURIComponent(placeName)}${
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
