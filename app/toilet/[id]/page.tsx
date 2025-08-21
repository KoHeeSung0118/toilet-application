// app/toilet/[id]/page.tsx
import ToiletDetailPage from '@/components/detail/ToiletDetailPage';
import { getUserIdFromToken } from '@/lib/getUserIdFromToken';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ place_name?: string; from?: string } | undefined>;
};

// 서버에서 API 호출할 때는 절대 URL을 사용해야 합니다.
async function fetchToilet(baseUrl: string, id: string, place_name?: string) {
  const qs = place_name ? `?place_name=${encodeURIComponent(place_name)}` : '';
  const url = `${baseUrl}/api/toilet/${id}${qs}`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`Failed to load toilet: ${resp.status}`);
  }
  return resp.json();
}

export default async function Page({ params, searchParams }: PageProps) {
  // ✅ Next 15 규칙: 반드시 await 후 사용
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const place_name = sp.place_name ?? '';
  const from = sp.from ?? '';

  // ✅ 로그인 강제: 서버에서 non-null 보장
  const uid = await getUserIdFromToken();
  if (!uid) {
    redirect('/login');
  }

  // ✅ 절대 URL 만들기 (프록시/배포 환경 고려)
  const h = await headers();
  const host =
    h.get('x-forwarded-host') ??
    h.get('host') ??
    (process.env.VERCEL_URL ?? 'localhost:3000');
  const proto =
    h.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const baseUrl = `${proto}://${host}`;

  const toilet = await fetchToilet(baseUrl, id, place_name);

  return (
    <ToiletDetailPage
      id={id}
      placeName={place_name}
      from={from}
      currentUserId={uid}
      toilet={toilet}
    />
  );
}
