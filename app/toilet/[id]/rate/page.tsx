/* app/toilet/[id]/rate/page.tsx ------------------------------------------ */
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/util/database';
import RatingPage from './RatingPage';

/** 사용자-별 평점 타입 */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

export default async function RatePage({
  params,
}: {
  params: { id: string };
}) {
  /* 1) HttpOnly 쿠키에서 JWT 추출 (❗ await 필요) */
  const cookieStore = await cookies();                 // ✅ await 추가
  const token = cookieStore.get('token')?.value ?? '';

  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as { userId: string };

      userId = decoded.userId;

      /* 2) DB에서 내 별점 조회 */
      const db = (await connectDB).db('toilet_app');
      const toilet = await db
        .collection<{ ratingRecords?: RatingRecord[] }>('toilets')
        .findOne({ id: params.id });

      existingRating =
        toilet?.ratingRecords?.find(
          (r: RatingRecord) => r.userId === userId
        ) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  /* 3) 클라이언트 컴포넌트 렌더 */
  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
