import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { toiletId } = req.query;
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  // ✅ string 기반 즐겨찾기 검사
  const isFavorite = Array.isArray(user.favorites)
    ? user.favorites.includes(toiletId as string)
    : false;

  res.status(200).json({ isFavorite });
}
