// ✅ app/toilet/[id]/page.tsx
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { notFound } from 'next/navigation';

/** 내부 전용 타입 ― export 금지! */
type ToiletPageProps = {
  params: { id: string };
  searchParams?: {
    place_name?: string;
    from?: string;
  };
};

export default async function Page({
  params,
  searchParams,
}: ToiletPageProps) {
  /* 1) 쿠키 스토어 얻기 ― Next.js 15부터 cookies()가 Promise 반환 */
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  let currentUserId: string | null = null;

  /* 2) JWT 파싱 */
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

  /* 3) 화장실 데이터 요청 */
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/toilet/${params.id}` +
      `?place_name=${encodeURIComponent(searchParams?.place_name ?? '')}`,
    { cache: 'no-store' }
  );

  if (!res.ok) return notFound();
  const toilet = await res.json();

  /* 4) 상세 페이지 렌더링 */
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
