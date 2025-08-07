/* eslint-disable @typescript-eslint/ban-ts-comment */
/* @ts-nocheck */

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/util/database';
import RatingPage from './RatingPage';

export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

export default async function RatePage(
  props: { params: { id: string } }             // ❷ 타입 간단 명시
) {
  /* (1) 쿠키 */
  const token = (await cookies()).get('token')?.value ?? '';

  /* (2) 기본값 */
  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      /* (3) JWT 해독 */
      userId = (
        jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
      ).userId;

      /* (4) DB 연결 (connectDB는 Promise<MongoClient>) */
      const db = (await connectDB).db('toilet_app');

      /* (5) 내 별점 조회 */
      const toilet = await db
        .collection<{ ratingRecords?: RatingRecord[] }>('toilets')
        .findOne({ id: props.params.id });

      existingRating =
        toilet?.ratingRecords?.find(
          (r: RatingRecord) => r.userId === userId
        ) ?? null;
    } catch (err) {
      console.error('JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  return (
    <RatingPage
      id={props.params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
