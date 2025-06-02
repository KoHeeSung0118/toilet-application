// /pages/api/favorite/list.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

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
  const user = await db.collection('users').findOne({ _id: new (require('mongodb')).ObjectId(userId) });

  if (!user || !Array.isArray(user.favorites)) {
    return res.status(200).json([]);
  }

  const toilets = await db
    .collection('toilets') // ← 이 컬렉션에 즐겨찾기한 화장실 정보가 들어 있어야 해!
    .find({ id: { $in: user.favorites } })
    .toArray();

  res.status(200).json(toilets);
}
