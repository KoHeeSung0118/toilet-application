// ✅ app/toilet/[id]/page.tsx
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { notFound } from 'next/navigation';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export default async function Page({ params, searchParams }: any) {
  // params.id 는 string 으로 사용하므로 런타임 캐스팅만 신경 쓰면 됨
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

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/toilet/${params.id}` +
      `?place_name=${encodeURIComponent(searchParams?.place_name ?? '')}`,
    { cache: 'no-store' }
  );

  if (!res.ok) return notFound();
  const toilet = await res.json();

  return (
    <ToiletDetailPage
      id={params.id as string}
      placeName={searchParams?.place_name}
      from={searchParams?.from}
      currentUserId={currentUserId}
      toilet={toilet}
    />
  );
}
