// app/toilet/[id]/page.tsx
import { headers, cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import jwt from 'jsonwebtoken';
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';

/* 동적 세그먼트와 쿼리 타입 */
type RouteParams  = { id: string };
type SearchParams = { place_name?: string; from?: string };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;          // ❗ Promise 형태로 선언
  searchParams: Promise<SearchParams>;   // ❗
}) {
  /* 0. 동기 값 고정 → 먼저 await */
  const { id }               = await params;
  const { place_name = '', from = '' } = await searchParams;

  /* 1. 호스트 정보 */
  const hostHeader = await headers();
  const host       = hostHeader.get('host') ?? '';
  const protocol   = host.startsWith('localhost') ? 'http' : 'https';
  const baseURL    = `${protocol}://${host}`;

  /* 2. 로그인 사용자 */
  const token = (await cookies()).get('token')?.value ?? null;
  let currentUserId: string | null = null;
  if (token) {
    try {
      currentUserId = (
        jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string }
      ).userId;
    } catch (e) {
      console.error('[JWT Decode Error]', e);
    }
  }

  /* 3. 화장실 데이터 fetch */
  const query = place_name ? `?place_name=${encodeURIComponent(place_name)}` : '';
  const res   = await fetch(`${baseURL}/api/toilet/${id}${query}`, { cache: 'no-store' });
  if (!res.ok) return notFound();
  const toilet = await res.json();

  /* 4. 렌더 */
  return (
    <ToiletDetailPage
      id={id}
      placeName={place_name}
      from={from}
      currentUserId={currentUserId}
      toilet={toilet}
    />
  );
}
