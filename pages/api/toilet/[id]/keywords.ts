// 파일: pages/api/toilet/[id]/keywords.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const { id } = req.query;
  const { keywords } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: '잘못된 화장실 ID입니다.' });
  }

  if (!Array.isArray(keywords)) {
    return res.status(400).json({ message: 'keywords는 배열이어야 합니다.' });
  }

  const result = await db.collection('toilets').updateOne(
    { id },
    { $set: { keywords } }  // 🔄 덮어쓰기 방식으로 변경
  );

  res.status(200).json({ success: true, updated: result.modifiedCount > 0 });
}
