import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token');

  // ✅ 예외 처리: 정적 파일, API, 로그인/회원가입 페이지
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api') ||        // ← 중요!
    pathname === '/login' ||
    pathname === '/signup'
  ) {
    return NextResponse.next();
  }

  // ✅ 인증되지 않은 사용자 → 로그인 페이지로 리디렉션
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next(); // ✅ 통과
}
