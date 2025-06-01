'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import './RatingPage.css';

export default function RatingPage({ params }: { params: { id: string } }) {
  const [overall, setOverall] = useState(3);
  const [clean, setClean] = useState(0);
  const [facility, setFacility] = useState(0);
  const [convenience, setConvenience] = useState(0);

  const router = useRouter();

  const handleRate = (setter: (v: number) => void, value: number) => {
    setter(value);
  };

  const renderStars = (score: number, setter: (v: number) => void) => {
    return [...Array(5)].map((_, i) => (
      <span
        key={i}
        onClick={() => handleRate(setter, i + 1)}
        style={{ color: i < score ? '#6AA0BD' : '#C7EBFF', fontSize: '24px', cursor: 'pointer' }}
      >
        ★
      </span>
    ));
  };

  return (
    <div className="rating-page">
      <h2 className="title">a화장실</h2>

      <div className="star-row">{renderStars(overall, setOverall)}</div>

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

      <button className="submit-btn">등록 하기</button>
      <button className="back-btn" onClick={() => router.back()}>뒤로 가기</button>
    </div>
  );
}
