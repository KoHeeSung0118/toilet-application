// pages/api/toilet/[id]/comment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import jwt from 'jsonwebtoken';

type Review = {
  _id: string;          // 문자열(ISO)로 저장
  userId: string;
  nickname: string;
  comment: string;
  createdAt: Date;
};
interface ToiletDoc {
  id: string;
  reviews?: Review[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // 1) JWT 검증
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  let userId = '';
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  // 2) 파라미터
  const toiletId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const { comment } = (req.body ?? {}) as { comment?: string };
  const clean = (comment ?? '').trim();
  if (!toiletId) return res.status(400).json({ message: '화장실 ID가 필요합니다.' });
  if (!clean) return res.status(400).json({ message: '댓글이 비어있습니다.' });
  if (clean.length > 1000) return res.status(400).json({ message: '댓글은 1000자 이하여야 합니다.' });

  // 3) DB
  const client = await connectDB;
  const db = client.db('toilet_app');
  const toilets = db.collection<ToiletDoc>('toilets');

  const toilet = await toilets.findOne({ id: String(toiletId) }, { projection: { id: 1, reviews: 1 } });
  if (!toilet) return res.status(404).json({ message: '해당 화장실을 찾을 수 없습니다.' });

  // 4) 닉네임 계산(해당 화장실 내에서 동일 userId 유지, 없으면 새 번호)
  const reviews = toilet.reviews ?? [];
  const existing = reviews.find(r => r.userId === userId);
  let nickname = existing?.nickname;
  if (!nickname) {
    // 간단히 기존 고유 사용자 수 + 1 사용
    const uniqueUsers = new Set(reviews.map(r => r.userId));
    nickname = `익명${uniqueUsers.size + 1}`;
  }

  // 5) 새 댓글 생성
  const now = new Date();
  const newComment: Review = {
    _id: now.toISOString(),
    userId,
    nickname,
    comment: clean,
    createdAt: now,
  };

  // 6) 저장
  await toilets.updateOne(
    { id: String(toiletId) },
    { $push: { reviews: { $each: [newComment] } } }
  );

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, comment: { ...newComment } });
}
