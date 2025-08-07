/* @ts-nocheck */

// app/toilet/[id]/rate/page.tsx

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/util/database';
import RatingPage from './RatingPage';

/** 개별 사용자 평점 레코드 */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

/** params 타입: Next 15 PageProps 제한과 100% 호환 */
type Params = Record<string, string>;

export default async function RatePage(
  { params }: { params: Params }
) {
  /* (1) 쿠키 - Next 15에선 Promise<ReadonlyRequestCookies> */
  const token = (await cookies()).get('token')?.value ?? '';

  /* 기본값 */
  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      /* (2) JWT 해독 */
      userId = (
        jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
      ).userId;

      /* (3) DB 연결 – connectDB 자체가 Promise<MongoClient> */
      const client = await connectDB;
      const db = client.db('toilet_app');

      /* (4) 내 별점 찾기 */
      type ToiletDoc = { ratingRecords?: RatingRecord[] };
      const toilet = await db
        .collection<ToiletDoc>('toilets')
        .findOne({ id: params.id });

      existingRating =
        toilet?.ratingRecords?.find(
          (r: RatingRecord) => r.userId === userId        // implicit any 제거
        ) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  /* (5) 클라이언트 컴포넌트 렌더 */
  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
