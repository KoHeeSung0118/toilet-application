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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch('/api/post/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        password,
        remember: remember ? 'on' : 'off',
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.message); // 로그인 성공
      router.push('/');
    } else {
      alert(data.message); // 실패 이유 출력
      router.push('/signup');
    }
  };

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
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <button type="submit" className="login-button">Sign in</button>
      </form>

      <Link href="/signup" className="login-button link-button">
        Sign up
      </Link>
    </div>
  );
}
