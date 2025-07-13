// ✅ pages/api/toilet/[id]/comment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

type Review = {
  _id: string;
  userId: string;
  nickname: string;
  comment: string;
  createdAt: Date;
};
interface ToiletDoc {
  id: string;
  reviews?: Review[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  /* JWT 검증 */
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });

  let userId = '';
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  /* 파라미터 */
  const { comment } = req.body;
  if (!comment?.trim()) {
    return res.status(400).json({ message: '댓글이 비어있습니다.' });
  }
  const toiletId = req.query.id as string;

  /* DB */
  const db = (await connectDB).db('toilet_app');
  const toilets = db.collection<ToiletDoc>('toilets');

  const toilet = await toilets.findOne({ id: toiletId });
  if (!toilet) {
    return res.status(404).json({ message: '해당 화장실을 찾을 수 없습니다.' });
  }

  /* 닉네임 */
  const reviews = toilet.reviews ?? [];
  const nicknameMap: Record<string, string> = {};
  let count = 1;
  for (const r of reviews) {
    if (!nicknameMap[r.userId]) nicknameMap[r.userId] = `익명${count++}`;
  }
  const nickname = nicknameMap[userId] ?? `익명${count}`;

  /* 새 댓글 */
  const newComment: Review = {
    _id: new Date().toISOString(),
    userId,
    nickname,
    comment: comment.trim(),
    createdAt: new Date(),
  };

  /* $push ― $each 로 타입 오류 해결 */
  await toilets.updateOne(
    { id: toiletId },
    {
      $push: { reviews: { $each: [newComment] } },
    }
  );

  return res.status(200).json({ success: true });
}
