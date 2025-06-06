import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId: string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (err) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

  if (!user || !Array.isArray(user.favorites)) {
    return res.status(200).json([]);
  }

  // 즐겨찾기된 화장실 정보 가져오기
  const toilets = await db
    .collection('toilets')
    .find({ id: { $in: user.favorites } })
    .toArray();

  // ❗ 평점이 없으면 3.0 기본값으로 설정
  const processed = toilets.map((toilet) => ({
    ...toilet,
    overallRating: toilet.overallRating ?? 3.0,
  }));

  res.status(200).json(processed);
}