'use client';

import { useState, FormEvent } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;
  /** 요청이 성공적으로 생성된 직후 호출 (선택) */
  onCreated?: () => void | Promise<void>;
};

export default function PaperRequestForm({
  toiletId,
  lat,
  lng,
  userId,
  onCreated,
}: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) {
      alert('요청 내용을 입력해 주세요.');
      return;
    }
    if (msg.length > 120) {
      alert('메시지는 120자 이내로 입력해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const resp = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toiletId,
          lat,
          lng,
          userId,
          message: msg,
        }),
      });

      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? '요청 전송에 실패했습니다.');
        return;
        }

      // 성공: 입력 초기화 + 상위 갱신 콜백
      setMessage('');
      if (onCreated) {
        await onCreated();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="request-row" onSubmit={handleSubmit}>
      <input
        className="action-input"
        type="text"
        placeholder="예: 남자 화장실 2번째 칸입니다."
        value={message}
        maxLength={120}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
      />
      <button className="action-btn" type="submit" disabled={loading}>
        {loading ? '보내는 중…' : '요청 보내기'}
      </button>
    </form>
  );
}
