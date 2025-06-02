import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const { toiletId } = req.body;
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId: string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const user = await db.collection('users').findOne({ _id: new (require('mongodb')).ObjectId(userId) });

  if (!user) {
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  }

  // 🔁 string 기반으로 즐겨찾기 처리
  const isFavorite = Array.isArray(user.favorites)
    ? user.favorites.includes(toiletId)
    : false;

  if (isFavorite) {
    await db.collection('users').updateOne(
      { _id: new (require('mongodb')).ObjectId(userId) },
      { $pull: { favorites: toiletId } }
    );
  } else {
    await db.collection('users').updateOne(
      { _id: new (require('mongodb')).ObjectId(userId) },
      { $addToSet: { favorites: toiletId } }
    );
  }

  res.status(200).json({ isFavorite: !isFavorite });
}
