'use client';
import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId?: string | null;
};

export default function RequestPaperButton({ toiletId, lat, lng, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 120자 제한 (서버와 동일)
    const v = e.target.value.slice(0, 120);
    setMessage(v);
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const body = {
        toiletId,
        lat,
        lng,
        userId,
        message: message.trim() || null, // ✅ 메모 전달
      };
      const res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: { ok?: true; error?: string } = await res.json();

      if (!res.ok || !data?.ok) {
        alert(data?.error ?? '요청 실패');
      } else {
        alert('휴지 요청이 전송되었어요!');
        setMessage(''); // 전송 성공 시 입력 초기화
      }
    } catch {
      alert('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        type="text"
        className="action-input"       // ✅ 스타일은 DetailPage.css에
        placeholder="여기에 요청 메모를 입력하세요."
        value={message}
        onChange={onChange}
        maxLength={120}
        aria-label="요청 메모 입력"
      />
      <button
        type="button"
        className="action-btn"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
        aria-label="휴지 요청"
        title="휴지 요청"
      >
        {loading ? '요청 중…' : '휴지 요청'}
      </button>
    </>
  );
}
