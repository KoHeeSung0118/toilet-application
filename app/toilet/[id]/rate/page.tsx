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

interface PageProps {
  params: {
    id: string;
  };
}

export default async function RatePage({ params }: PageProps) {
  const cookieStore = cookies() // ✅ 깔끔한 해결법
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

  return (
    <RatingPage
      id={params.id}
      userId={userId}
      existingRating={existingRating}
    />
  );
}
