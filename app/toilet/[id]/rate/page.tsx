import { headers } from 'next/headers';
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

export default async function RatePage({ params }: { params: { id: string } }) {
  const cookieHeader = headers().get('cookie') || '';
  const token = cookieHeader
    .split('; ')
    .find((cookie: string) => cookie.startsWith('token='))?.split('=')[1];

  let userId: string | null = null;
  let existingRating: RatingRecord | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string };
      userId = decoded.userId;

      const db = (await connectDB).db('toilet_app');
      const toilet = await db.collection('toilets').findOne({ id: params.id });

      if (toilet?.ratingRecords) {
        existingRating = (toilet.ratingRecords as RatingRecord[]).find(
          (r) => r.userId === userId
        ) ?? null;
      }
    } catch (err) {
      console.error('❌ JWT 해독 또는 DB 조회 실패:', err);
    }
  }

  return <RatingPage id={params.id} userId={userId} existingRating={existingRating} />;
}
