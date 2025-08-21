'use client';

import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;                 // 로그인 강제라 null 아님
  onSubmitted?: () => void;       // ✅ 전송 후 부모에서 즉시 갱신
};

export default function PaperRequestForm({ toiletId, lat, lng, userId, onSubmitted }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;
    const trimmed = message.trim();
    if (trimmed.length > 120) {
      alert('메시지는 최대 120자까지 가능합니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toiletId,
          lat,
          lng,
          userId,
          message: trimmed || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error ?? '요청 실패');
        return;
      }
      // ✅ 전송 성공 → 부모에게 즉시 갱신 요청
      onSubmitted?.();
      // 입력 초기화
      setMessage('');
    } catch {
      alert('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        className="action-input"
        type="text"
        placeholder="예: 남자 화장실 2번째 칸입니다."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={120}
      />
      <button className="action-btn" type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? '전송 중...' : '휴지 요청'}
      </button>
    </>
  );
}
