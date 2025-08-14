'use client';
import { useState } from 'react';

type Props = { toiletId: string; lat: number; lng: number; userId?: string | null };

export default function RequestPaperButton({ toiletId, lat, lng, userId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, lat, lng, userId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data?.error ?? '요청 실패');
      else alert('휴지 요청이 전송되었어요!');
    } catch {
      alert('네트워크 오류');
    } finally {
      setLoading(false);
    }
    console.log('📤 request-paper send', { toiletId, lat, lng });
  }

  return (
    <button
      type="button"
      className="action-btn"            // ✅ 여기! 버튼 스타일 클래스
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      aria-label="휴지 요청"
    >
      {loading ? '요청 중…' : '휴지 요청'}
    </button>
  );
}
