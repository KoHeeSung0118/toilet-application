import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: '로그인 필요' });
  }

  const JWT_SECRET = process.env.JWT_SECRET!;
  let userId = '';
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: '유효하지 않은 토큰' });
  }

  const { commentId } = req.body;
  const toiletId = req.query.id as string;

  if (!commentId || !toiletId) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }

  const db = (await connectDB).db('toilet_app');

  const result = await db.collection('toilets').updateOne(
    { id: toiletId },
    { $pull: { reviews: { _id: commentId, userId } } } // ⚠️ userId 일치하는 댓글만 삭제
  );

  if (result.modifiedCount === 0) {
    return res.status(403).json({ message: '댓글 삭제 권한 없음 또는 댓글 없음' });
  }

  return res.status(200).json({ success: true, message: '댓글이 삭제되었습니다.' });
}
