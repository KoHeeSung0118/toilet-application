'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../login/LoginForm.css';

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    // 1) API 호출
    const res = await fetch('/api/post/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, passwordConfirm }),
    });

    // 2) JSON 파싱 & 경고창
    const body = await res.json();
    alert(body.message);

    // 3) 성공 시 /login으로 이동
    if (body.ok) {
      router.push('/login');
    }

    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <Link href="/login" className="back-link">
        ← 뒤로 가기
      </Link>

      <h1 className="login-title">회원 가입</h1>

      {/* action, method 모두 제거하고 onSubmit만 사용 */}
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          placeholder="이메일"
          className="login-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="login-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호 확인"
          className="login-input"
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
          required
        />
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? '가입 중…' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
