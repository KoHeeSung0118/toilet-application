'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { RatingRecord } from './page';
import './RatePage.css';

interface RatingPageProps {
  id: string;
  userId: string | null;
  existingRating: RatingRecord | null;
}

export default function RatingPage({ id, userId, existingRating }: RatingPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams?.get('from') ?? '';

  const [placeName, setPlaceName] = useState('불러오는 중...');
  const [overall, setOverall] = useState(existingRating?.overall ?? 0);
  const [clean, setClean] = useState(existingRating?.cleanliness ?? 0);
  const [facility, setFacility] = useState(existingRating?.facility ?? 0);
  const [convenience, setConvenience] = useState(existingRating?.convenience ?? 0);

  const isEditing = !!existingRating;

  useEffect(() => {
    const fetchToilet = async () => {
      const res = await fetch(`/api/toilet/${id}`);
      const data = await res.json();
      setPlaceName(data.place_name || '이름 없음');
    };
    fetchToilet();
  }, [id]);

  const handleSubmit = async () => {
    if (!userId) {
      alert('로그인 후 별점을 등록할 수 있습니다.');
      return;
    }

    const res = await fetch(`/api/toilet/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        overall,
        cleanliness: clean,
        facility,
        convenience,
      }),
    });

    if (res.ok) {
      router.replace(
        `/toilet/${id}?place_name=${encodeURIComponent(placeName)}${
          from ? `&from=${from}` : ''
        }`
      );
      router.refresh();
    } else {
      const error = await res.json();
      console.error('❌ 서버 응답:', error);
      alert('별점 등록에 실패했습니다.');
    }
  };

  const renderStars = (score: number, setter: (v: number) => void) =>
    [...Array(5)].map((_, i) => (
      <span
        key={i}
        onClick={() => setter(i + 1)}
        style={{
          color: i < score ? '#F5A623' : '#DDD',
          fontSize: '24px',
          cursor: 'pointer',
        }}
      >
        ★
      </span>
    ));

  return (
    <div className="page-container">
      <h2 className="title">{placeName}</h2>

      <div className="label-row">
        <label>종합</label>
        <div className="star-row">{renderStars(overall, setOverall)}</div>
      </div>
      <div className="label-row">
        <label>청결</label>
        <div className="star-row">{renderStars(clean, setClean)}</div>
      </div>
      <div className="label-row">
        <label>시설</label>
        <div className="star-row">{renderStars(facility, setFacility)}</div>
      </div>
      <div className="label-row">
        <label>편의</label>
        <div className="star-row">{renderStars(convenience, setConvenience)}</div>
      </div>

      <button className="submit-btn" onClick={handleSubmit}>
        {isEditing ? '수정 하기' : '등록 하기'}
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
