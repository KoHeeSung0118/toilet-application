// components/detail/PaperRequestForm.tsx
'use client';
import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;      // 로그인 강제 가정
  onSent?: () => void;        // 전송 후 목록 새로고침 등
};

export default function PaperRequestForm({
  toiletId,
  lat,
  lng,
  userId,
  onSent,
}: Props) {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (loading) return;
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }
    const text = msg.trim();
    if (text.length > 120) {
      alert('메시지는 120자 이내로 입력해 주세요.');
      return;
    }
    setLoading(true);
    let res: Response;
    try {
      res = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toiletId, lat, lng, message: text || undefined }),
      });
    } catch (e) {
      console.error('request send error', e);
      alert('네트워크 오류로 요청을 보낼 수 없어요.');
      setLoading(false);
      return;
    }

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data?.ok) {
      alert(data?.error ?? '요청 실패');
      setLoading(false);
      return;
    }

    setMsg('');
    setLoading(false);
    if (onSent) onSent();
    alert('휴지 요청이 전송되었어요!');
  };

  return (
    <div className="request-row" style={{ width: '100%', display: 'flex', gap: '.6rem', alignItems: 'center' }}>
      <input
        className="action-input"
        placeholder="예: 남자 화장실 2번째 칸입니다."
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={120}
      />
      <button className="action-btn" onClick={() => void handleSend()} disabled={loading}>
        {loading ? '보내는 중…' : '휴지 요청'}
      </button>
    </div>
  );
}
