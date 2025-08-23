// pages/api/favorite/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId: string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  // toiletId 파라미터 확인 (string | string[])
  const qp = req.query.toiletId;
  const toiletId = Array.isArray(qp) ? qp[0] : qp;
  if (!toiletId) return res.status(400).json({ message: 'toiletId가 필요합니다.' });

  // 사용자 ObjectId 검증
  let _id: ObjectId;
  try {
    _id = new ObjectId(userId);
  } catch {
    return res.status(400).json({ message: '잘못된 사용자 ID' });
  }

  const client = await connectDB;
  const db = client.db('toilet_app'); // 프로젝트에서 사용하는 DB명과 일치하는지 확인
  const users = db.collection<{ favorites?: string[] }>('users');

  // favorites만 projection
  const user = await users.findOne({ _id }, { projection: { favorites: 1 } });
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  // 즐겨찾기 여부 (문자열 기준)
  const isFavorite = Array.isArray(user.favorites)
    ? user.favorites.includes(String(toiletId))
    : false;

  return res.status(200).json({ isFavorite });
}
