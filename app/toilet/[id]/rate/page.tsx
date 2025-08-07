/* app/toilet/[id]/rate/page.tsx ------------------------------------------ */
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import {connectDB} from '@/util/database';     // ✨ Promise<MongoClient>
import RatingPage from './RatingPage';

/** 한 사용자의 별점 레코드 */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

interface PageProps {
  params: { id: string };
}

export default async function RatePage({ params }: PageProps) {
  /* ── 1. 쿠키 (Next 15에서는 Promise) ───────────────────────────── */
  const cookieStore = await cookies();                       // await OK
  const token = cookieStore.get('token')?.value ?? '';

  /* ── 2. 기본값 초기화 ───────────────────────────────────────────── */
  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      /* ── 3. JWT 해독 ───────────────────────────────────────────── */
      userId = (
        jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
      ).userId;

      /* ── 4. DB 연결 (connectDB는 Promise) ─────────────────────── */
      const client = await connectDB;                        // 함수 호출 아님!
      const db = client.db('toilet_app');

      /* ── 5. 내 별점 레코드 조회 ───────────────────────────────── */
      type ToiletDoc = { ratingRecords?: RatingRecord[] };
      const toilet = await db
        .collection<ToiletDoc>('toilets')
        .findOne({ id: params.id });

      existingRating =
        toilet?.ratingRecords?.find(
          (r: RatingRecord) => r.userId === userId           // r 타입 명시
        ) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  /* ── 6. 클라이언트 컴포넌트 렌더 ─────────────────────────────── */
  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
