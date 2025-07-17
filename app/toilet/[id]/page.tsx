// app/toilet/[id]/page.tsx
import { headers, cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import jwt from 'jsonwebtoken';
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';

interface PageProps {
  params: { id: string };
  searchParams: { place_name?: string; from?: string };
}

export default async function Page({ params, searchParams }: PageProps) {
  /* 0. 동기 값은 함수 시작과 동시에 고정 */
  const id        = params.id;
  const placeName = searchParams?.place_name
    ? decodeURIComponent(searchParams.place_name)
    : '';
  const from      = searchParams?.from ?? '';

  /* 1. 호스트 정보 */
  const hostHeader = await headers(); // 비동기 API
  const host       = hostHeader.get('host') ?? '';
  const protocol   = host.startsWith('localhost') ? 'http' : 'https';
  const baseURL    = `${protocol}://${host}`;

  /* 2. 로그인 사용자 */
  const token = (await cookies()).get('token')?.value ?? null; // 비동기 API
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
  const query = placeName ? `?place_name=${encodeURIComponent(placeName)}` : '';
  const res   = await fetch(`${baseURL}/api/toilet/${id}${query}`, {
    cache: 'no-store',
  });
  if (!res.ok) return notFound();
  const toilet = await res.json();

  /* 4. 렌더 */
  return (
    <ToiletDetailPage
      id={id}
      placeName={placeName}
      from={from}
      currentUserId={currentUserId}
      toilet={toilet}
    />
  );
}
