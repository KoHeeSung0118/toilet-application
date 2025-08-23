// pages/api/favorite/toggle.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  const { toiletId, toilet } = req.body as { toiletId?: string; toilet?: any };
  if (!toiletId || typeof toiletId !== 'string') {
    return res.status(400).json({ message: 'toiletId가 필요합니다.' });
  }

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId: string;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  // 사용자 ObjectId 검증
  let _id: ObjectId;
  try {
    _id = new ObjectId(userId);
  } catch {
    return res.status(400).json({ message: '잘못된 사용자 ID' });
  }

  const client = await connectDB;
  const db = client.db('toilet_app'); // 프로젝트 DB명과 일치 확인
  const users = db.collection<{ _id: ObjectId; favorites?: string[] }>('users');

  // favorites만 가져오기
  const user = await users.findOne({ _id }, { projection: { favorites: 1 } });
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  const isFavorite = Array.isArray(user.favorites) ? user.favorites.includes(toiletId) : false;

  if (isFavorite) {
    await users.updateOne({ _id }, { $pull: { favorites: toiletId } });
  } else {
    await users.updateOne({ _id }, { $addToSet: { favorites: toiletId } });

    // 화장실 메타 저장: 없으면 upsert
    if (toilet && typeof toilet === 'object') {
      const toilets = db.collection('toilets');
      await toilets.updateOne(
        { id: toiletId },
        {
          $setOnInsert: {
            id: toiletId,
            place_name: toilet.place_name || '이름 미정',
            ...toilet,
          },
        },
        { upsert: true }
      );
    }
  }

  return res.status(200).json({ isFavorite: !isFavorite });
}
