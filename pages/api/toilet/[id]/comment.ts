import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '허용되지 않은 메서드입니다.' });
  }

  // 1. JWT 쿠키에서 사용자 ID 확인
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  let userId = '';
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  // 2. 댓글 내용 확인
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ message: '댓글이 비어있습니다.' });
  }

  // 3. 화장실 ID 추출 (params.id는 string)
  const toiletId = req.query.id as string;

  const db = (await connectDB).db('toilet_app');

  // 4. 화장실 존재 확인
  const toilet = await db.collection('toilets').findOne({ id: toiletId });
  if (!toilet) {
    return res.status(404).json({ message: '해당 화장실을 찾을 수 없습니다.' });
  }

  const reviews = toilet.reviews ?? [];

  // 5. 익명 닉네임 생성
  const nicknameMap: Record<string, string> = {};
  let count = 1;
  for (const r of reviews) {
    if (!nicknameMap[r.userId]) {
      nicknameMap[r.userId] = `익명${count++}`;
    }
  }
  const nickname = nicknameMap[userId] ?? `익명${count}`;

  // 6. 새로운 댓글 객체 생성
  const newComment = {
    _id: new Date().toISOString(), // 간단한 고유 ID
    userId,
    nickname,
    comment: comment.trim(),
    createdAt: new Date(),
  };

  // 7. DB에 댓글 추가
  await db.collection('toilets').updateOne(
    { id: toiletId },
    { $push: { reviews: newComment } }
  );

  return res.status(200).json({ success: true });
}
