// ✅ app/toilet/[id]/page.tsx
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { notFound } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function Page({ params, searchParams }: any) {
  /* 1. 사용자 토큰 확인 */
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let currentUserId: string | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { userId: string };
      currentUserId = decoded.userId;
    } catch (e) {
      console.error('JWT Decode Error:', e);
    }
  }

  /* 2. 화장실 데이터 요청 ― id만으로 조회 */
  const res = await fetch(
    `/api/toilet/${params.id}`,       // ← 절대 URL 대신 상대 경로
    { cache: 'no-store' }
  );

  if (!res.ok) return notFound();
  const toilet = await res.json();

  /* 3. 상세 페이지 렌더 */
  return (
    <ToiletDetailPage
      id={params.id as string}
      placeName={searchParams?.place_name}  // 표시용만 유지
      from={searchParams?.from}
      currentUserId={currentUserId}
      toilet={toilet}
    />
  );
}
