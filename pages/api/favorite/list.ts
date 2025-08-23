import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

interface Toilet {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  keywords?: string[];
  reviews?: {
    _id: string;
    userId: string;
    nickname: string;
    comment: string;
    createdAt: string | Date;
  }[];
  cleanliness?: number;
  facility?: number;
  convenience?: number;
  overallRating?: number;
}

interface UserDoc {
  _id: ObjectId;
  favorites?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    return res
      .status(401)
      .json({ message: '유효하지 않은 토큰입니다.' });
  }

  // ObjectId 유효성 체크
  let _id: ObjectId;
  try {
    _id = new ObjectId(userId);
  } catch {
    return res.status(400).json({ message: '잘못된 사용자 ID' });
  }

  const client = await connectDB;
  const db = client.db('toilet_app'); // ✅ DB 이름 프로젝트와 통일 확인
  const users = db.collection<UserDoc>('users');

  // favorites만 가져오기
  const user = await users.findOne(
    { _id },
    { projection: { favorites: 1 } }
  );

  const favs = Array.isArray(user?.favorites) ? user.favorites : [];
  if (favs.length === 0) return res.status(200).json([]);

  // 중복 제거 + 최대 200개 제한
  const uniqueFavs = [...new Set(favs)].slice(0, 200);

  // 즐겨찾기 순서 유지를 위한 인덱스 맵
  const order = new Map(uniqueFavs.map((id, i) => [id, i]));

  const toiletsCol = db.collection<Toilet>('toilets');
  const toilets = await toiletsCol
    .find({ id: { $in: uniqueFavs } })
    .toArray();

  // 순서 보존 정렬
  toilets.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );

  const processed = toilets.map((t) => ({
    ...t,
    overallRating: t.overallRating ?? 3.0,
  }));

  return res.status(200).json(processed);
}
