/* app/toilet/[id]/rate/page.tsx ------------------------------------------ */
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/util/database';
import RatingPage from './RatingPage';

/** 한 사용자-별 별점 레코드 타입 (API·클라이언트와 공유) */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

/** 서버 컴포넌트 */
export default async function RatePage({ params }: { params: { id: string } }) {
  /* ── HttpOnly 쿠키에서 JWT 추출 ─────────────────── */
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const token = cookieHeader
    .split('; ')
    .find((c: string) => c.startsWith('token='))?.split('=')[1];

  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as { userId: string };

      userId = decoded.userId;

      /* ── DB에서 내 기존 별점 찾아오기 ──────────────── */
      const db = (await connectDB).db('toilet_app');
      const toilet = await db
        .collection<{ ratingRecords?: RatingRecord[] }>('toilets')
        .findOne({ id: params.id });

      existingRating =
        toilet?.ratingRecords?.find((r) => r.userId === userId) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  /* ── 클라이언트 컴포넌트 렌더 ───────────────────── */
  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
