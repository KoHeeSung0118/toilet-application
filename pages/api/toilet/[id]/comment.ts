import { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { comment, user } = req.body;
  const { id } = req.query;

  if (!comment || !user) return res.status(400).json({ message: '필수 항목 누락' });

  const db = (await connectDB).db('toilet_app');
  await db.collection('toilets').updateOne(
    { id },
    { $push: { reviews: { user, comment } } },
    { upsert: true }
  );

  return res.status(200).json({ message: '댓글 등록 완료' });
}
