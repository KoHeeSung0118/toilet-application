
'use client';

import Link from 'next/link';
import './LoginForm.css'; // 스타일 분리

export default function LoginPage() {
  return (
    <div className="login-wrapper">
      <h1 className="login-title">로그인</h1>
      <form action="/api/post/login" method="POST" className="login-form">
        <input
          type="email"
          name="email"
          placeholder="이메일"
          className="login-input"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          className="login-input"
          required
        />
        <label className="login-checkbox">
          <input type="checkbox" name="remember" />
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
