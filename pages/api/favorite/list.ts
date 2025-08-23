// pages/api/favorite/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId: string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  // ObjectId 유효성 체크
  let _id: ObjectId;
  try {
    _id = new ObjectId(userId);
  } catch {
    return res.status(400).json({ message: '잘못된 사용자 ID' });
  }

  const client = await connectDB;
  const db = client.db('toilet_app'); // ← 이 DB 이름이 맞는지 프로젝트와 통일 확인
  const users = db.collection('users');

  // favorites만 가져오도록 projection
  const user = await users.findOne<{ favorites?: string[] }>(
    { _id },
    { projection: { favorites: 1 } }
  );

  const favs = Array.isArray(user?.favorites) ? user!.favorites : [];
  if (favs.length === 0) return res.status(200).json([]);

  // 중복 제거 + 과도한 개수 컷 (예: 200개)
  const uniqueFavs = [...new Set(favs)].slice(0, 200);

  // 즐겨찾기 순서를 유지하기 위한 인덱스 맵
  const order = new Map(uniqueFavs.map((id, i) => [id, i]));

  const toiletsCol = db.collection('toilets');
  const toilets = await toiletsCol
    .find({ id: { $in: uniqueFavs } })
    .toArray();

  // 원래 즐겨찾기 순서대로 정렬
  toilets.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const processed = toilets.map((t: any) => ({
    ...t,
    overallRating: t.overallRating ?? 3.0,
  }));

  return res.status(200).json(processed);
}
