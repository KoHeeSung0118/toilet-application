'use client';

import Link from 'next/link';
import '../login/LoginForm.css'; // 로그인 폼과 스타일 공유

export default function SignupForm() {
  return (
    <div className="login-wrapper">
      <Link href="/login" className="back-link">← 뒤로 가기</Link>

      <h1 className="login-title">회원 가입</h1>

      <form action="/api/post/signup" method="POST" className="login-form">
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
        <input
          type="password"
          name="passwordConfirm"
          placeholder="비밀번호 확인"
          className="login-input"
          required
        />
        <button type="submit" className="login-button">가입하기</button>
      </form>
    </div>
  );
}
