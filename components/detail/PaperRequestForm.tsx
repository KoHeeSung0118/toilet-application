'use client';

import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;            // 로그인 강제
  onSuccess?: () => void;    // 성공 시 부모 갱신
};

export default function PaperRequestForm({ toiletId, lat, lng, userId, onSuccess }: Props) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const message = msg.trim().slice(0, 120);

    setLoading(true);
    try {
      const res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, lat, lng, userId, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error ?? '요청 실패');
        return;
      }
      setMsg('');
      onSuccess?.(); // 즉시 갱신
    } catch {
      alert('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        className="action-input"
        placeholder="메시지 (예: 남자 화장실 2번째 칸)"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={120}
      />
      <button type="button" className="action-btn" onClick={submit} disabled={loading}>
        {loading ? '전송 중...' : '휴지 요청'}
      </button>
    </>
  );
}
