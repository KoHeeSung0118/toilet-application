'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import './RatingPage.css'; 

export default function RatingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeName = searchParams.get('place_name') ?? '이름 미정';

  const [overall, setOverall] = useState(3);
  const [clean, setClean] = useState(0);
  const [facility, setFacility] = useState(0);
  const [convenience, setConvenience] = useState(0);

  const handleRate = (setter: (v: number) => void, value: number) => {
    setter(value);
  };

  const renderStars = (score: number, setter: (v: number) => void) => {
    return [...Array(5)].map((_, i) => (
      <span
        key={i}
        onClick={() => handleRate(setter, i + 1)}
        style={{
          color: i < score ? '#6AA0BD' : '#C7EBFF',
          fontSize: '24px',
          cursor: 'pointer',
        }}
      >
        ★
      </span>
    ));
  };

  const handleSubmit = () => {
    console.log('⭐ 제출된 별점:', {
      overall,
      clean,
      facility,
      convenience,
    });
    // 추후: fetch(`/api/toilet/${params.id}/rate`, ...)
    router.back();
  };

  return (
    <div className="rating-page">
      <h2 className="title">{placeName}</h2>

      <div className="label-row">
        <label>전체 평점</label>
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
        등록 하기
      </button>
      <button className="back-btn" onClick={() => router.back()}>
        뒤로 가기
      </button>
    </div>
  );
}
