'use client';
import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  onSent?: () => void; // ✅ 성공 후 부모 갱신 콜백
};

export default function RequestPaperButton({ toiletId, lat, lng, onSent }: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toiletId,
          lat,
          lng,
          message: msg.trim().slice(0, 120),
        }),
      });
      const data = (await res.json()) as { ok?: true; error?: string };
      if (!res.ok || !data.ok) {
        alert(data.error ?? '요청 실패');
        return;
      }
      setMsg('');
      onSent?.(); // ✅ 성공 즉시 부모 목록 갱신
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
        placeholder="요청 메모 (최대 120자)"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={120}
      />
      <button className="action-btn" onClick={handleClick} disabled={loading}>
        {loading ? '요청 중...' : '휴지 요청'}
      </button>
    </>
  );
}
