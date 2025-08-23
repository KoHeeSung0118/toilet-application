'use client';

import { useState } from 'react';

interface Props {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;               // 로그인 강제
  onCreated?: () => void | Promise<void>;
}

export default function PaperRequestForm({ toiletId, lat, lng, onCreated }: Props) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    if (!msg.trim()) {
      alert('간단한 위치/칸 정보를 적어주세요.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, lat, lng, message: msg.trim() }),
      });
      if (r.status === 409) {
        alert('이미 활성화된 요청이 있습니다.');
        return;
      }
      if (!r.ok) {
        alert('요청 실패');
        return;
      }
      setMsg('');
      await onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        className="action-input"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="예: 남자 화장실 2번째 칸입니다."
        maxLength={120}
      />
      <button className="action-btn" onClick={submit} disabled={loading}>
        {loading ? '보내는 중…' : '휴지 요청'}
      </button>
    </>
  );
}
