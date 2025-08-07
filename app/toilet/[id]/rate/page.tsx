/* app/toilet/[id]/rate/page.tsx */

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/util/database';      // named import
import RatingPage from './RatingPage';

/* 개별 별점 레코드 타입 */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

export default async function RatePage(
  { params }: { params: { id: string } }          // ★ PageProps 이름 사용 X
) {
  /* 1. 쿠키 (Next 15에선 Promise) */
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value ?? '';

  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      /* 2. JWT 해독 */
      userId = (
        jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
      ).userId;

      /* 3. DB 연결   (connectDB는 Promise<MongoClient>) */
      const client = await connectDB;            // 함수 호출 아님!
      const db = client.db('toilet_app');

      /* 4. 내 별점 찾기 */
      type ToiletDoc = { ratingRecords?: RatingRecord[] };
      const toilet = await db
        .collection<ToiletDoc>('toilets')
        .findOne({ id: params.id });

      existingRating =
        toilet?.ratingRecords?.find(
          (r: RatingRecord) => r.userId === userId   // implicit any 제거
        ) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
