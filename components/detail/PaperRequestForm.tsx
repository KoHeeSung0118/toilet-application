// components/detail/PaperRequestForm.tsx
'use client';
import { useState } from 'react';

type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string; // 전달은 되지만 현재 이 컴포넌트에서는 사용하지 않음
  onCreateStart?: (p: { message?: string }) => { tempId: string };
  onCreateSuccess?: (p: { tempId: string; id: string; expiresAt: string; message?: string }) => void;
  onCreateError?: (tempId: string) => void;
};

type ApiOk = { ok: true; id: string; expiresAt: string };
type ApiErr = { error: string };

export default function PaperRequestForm({
  toiletId,
  lat,
  lng,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: _userId, // <- 미사용 경고 제거 (리네이밍)
  onCreateStart,
  onCreateSuccess,
  onCreateError,
}: Props) {
  // 더미 사용으로 ESLint가 "사용됨"으로 인식
  void _userId;

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    const startInfo = onCreateStart?.({ message });
    const tempId = startInfo?.tempId;

    try {
      const r = await fetch('/api/signal/request-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // 같은 오리진 쿠키 확실히 포함
        body: JSON.stringify({ toiletId, lat, lng, message }),
      });

      // 본문은 한 번만 읽는다
      const text = await r.text();
      let data: ApiOk | ApiErr | null = null;
      try {
        data = text ? (JSON.parse(text) as ApiOk | ApiErr) : null;
      } catch {
        data = null;
      }

      if (!r.ok || !data || !('ok' in data) || !data.ok) {
        const code = r.status;
        const msg = data && 'error' in data ? data.error : undefined;
        if (tempId) onCreateError?.(tempId);

        alert(
          code === 401
            ? '로그인이 필요합니다.'
            : code === 409 && msg === 'already_active'
              ? '이미 진행 중인 요청이 있어요. 상단 카드에서 "요청 취소"를 누르거나 만료를 기다려주세요.'
              : msg ?? '요청에 실패했습니다.'
        );
        // 디버깅에 도움: 네트워크 탭 없이도 콘솔에서 확인
        console.debug('request-paper failed:', { status: code, text });
        return;
      }

      onCreateSuccess?.({
        tempId: tempId ?? '',
        id: data.id,
        expiresAt: data.expiresAt,
        message,
      });
      setMessage('');
    } catch (err) {
      if (tempId) onCreateError?.(tempId);
      alert('네트워크 오류가 발생했어요.');
      console.debug('request-paper network error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ “처음 디자인”의 클래스 적용 (.action-input / .action-btn)
  return (
    <form onSubmit={handleSubmit} className="active-item">
      <input
        className="action-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="예: 남자 화장실 2번째 칸입니다. (최대 120자)"
        maxLength={120}
      />
      <button type="submit" className="action-btn" disabled={submitting}>
        {submitting ? '보내는 중…' : '요청 보내기'}
      </button>
    </form>
  );
}
