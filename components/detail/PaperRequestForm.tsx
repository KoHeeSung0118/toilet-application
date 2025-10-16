import { useState } from "react";

// components/detail/PaperRequestForm.tsx
type Props = {
  toiletId: string;
  lat: number;
  lng: number;
  userId?: string | null;
};


export default function PaperRequestForm({ toiletId, lat, lng, userId: _userId }: Props) {
// 더미 사용으로 ESLint가 "사용됨"으로 인식
void _userId;

type ApiOk = { ok: true; id: string; expiresAt: string };
type ApiErr = { error: string };
const [message, setMessage] = useState('');
const [submitting, setSubmitting] = useState(false);


const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault();
if (submitting) return;


setSubmitting(true);


try {
const r = await fetch('/api/signal/request-paper', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
credentials: 'same-origin', // 같은 오리진 쿠키 확실히 포함
body: JSON.stringify({ toiletId, lat, lng, message }),
});


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
alert(
code === 401
? '로그인이 필요합니다.'
: code === 409 && msg === 'already_active'
? '이미 진행 중인 요청이 있어요. 상단 카드에서 "요청 취소"를 누르거나 만료를 기다려주세요.'
: msg ?? '요청에 실패했습니다.'
);
console.debug('request-paper failed:', { status: code, text });
return;
}


// 성공: 폼만 초기화. 카드는 Pusher의 paper_request 이벤트로만 추가됩니다.
setMessage('');
} catch (err) {
alert('네트워크 오류가 발생했어요.');
console.debug('request-paper network error:', err);
} finally {
setSubmitting(false);
}
};


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