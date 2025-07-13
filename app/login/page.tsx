'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import './LoginForm.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ───────── 핸들러 ───────── */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/post/login', {   // ✅ 실제 라우트 경로
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          remember: remember ? 'on' : 'off',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        alert(data.message ?? '로그인 성공');
        router.replace('/');                         // ✅ 홈 이동
      } else {
        alert(data.message ?? '로그인 실패');
      }
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);                             // ✅ 항상 loading 해제
    }
  }

  /* ───────── UI ───────── */
  return (
    <div className="login-wrapper">
      <h1 className="login-title">로그인</h1>

      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          name="email"
          placeholder="이메일"
          className="login-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          className="login-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <label className="login-checkbox">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={() => setRemember(!remember)}
          />
          로그인 정보 저장
        </label>

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? '로딩 중...' : '로그인'}
        </button>
      </form>

      <Link href="/signup" className="login-button link-button">
        회원가입
      </Link>
    </div>
  );
}
