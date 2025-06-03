// ✅ 1. pages/api/toilet/[id]/rate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { overall, cleanliness, facility, convenience } = req.body;

  const db = (await connectDB).db('toilet_app');

  const update = {
    $set: {
      cleanliness,
      facility,
      convenience,
    },
    $setOnInsert: {
      id: id as string,
    },
  };

  try {
    const result = await db.collection('toilets').updateOne(
      { id: id as string },
      update,
      { upsert: true }
    );
    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('🚨 별점 등록 실패:', err);
    return res.status(500).json({ error: '업데이트 실패' });
  }
}
