/* @ts-nocheck */

// app/toilet/[id]/rate/page.tsx
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export default async function RatePage({ params }: any) {
  // 1) 쿠키 (Next 15 → Promise)
  const token = (await cookies()).get('token')?.value ?? '';

  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      // 2) JWT 검증
      userId = (
        jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
      ).userId;

      // 3) DB 연결 (connectDB 자체가 Promise)
      const client = await connectDB;
      const db = client.db('toilet_app');

      // 4) 내 별점 찾기
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

  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
