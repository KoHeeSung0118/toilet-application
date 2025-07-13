// app/toilet/[id]/page.tsx
import { headers, cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { notFound } from 'next/navigation';
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function Page({ params, searchParams }: any) {
  /* 0. 현재 요청 호스트로 절대 URL 만들기 */
  const host = headers().get('host'); // ex) localhost:3000, toilet-application.vercel.app
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const baseURL = `${protocol}://${host}`;

  /* 1. 로그인 사용자 추출 */
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let currentUserId: string | null = null;

  if (token) {
    try {
      currentUserId = (
        jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string }
      ).userId;
    } catch (e) {
      console.error('JWT Decode Error:', e);
    }
  }

  /* 2. 화장실 데이터 fetch ─ id + (옵션) place_name */
  const query =
    searchParams?.place_name
      ? `?place_name=${encodeURIComponent(searchParams.place_name)}`
      : '';

  const res = await fetch(`${baseURL}/api/toilet/${params.id}${query}`, {
    cache: 'no-store',
  });

  if (!res.ok) return notFound();
  const toilet = await res.json();

  /* 3. 페이지 렌더 */
  return (
    <ToiletDetailPage
      id={params.id}
      placeName={searchParams?.place_name}
      from={searchParams?.from}
      currentUserId={currentUserId}
      toilet={toilet}
    />
  );
}
