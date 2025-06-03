// 파일: pages/api/toilet/[id]/comment.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const { id } = req.query;
  const { comment } = req.body;
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string };
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const toilet = await db.collection('toilets').findOne({ id });

  if (!toilet) {
    return res.status(404).json({ message: '화장실을 찾을 수 없습니다.' });
  }

  const review = {
    user: userId,
    comment,
  };

  await db.collection('toilets').updateOne(
    { id },
    { $push: { reviews: review } }
  );

  res.status(200).json({ message: '댓글이 성공적으로 등록되었습니다.' });
}
