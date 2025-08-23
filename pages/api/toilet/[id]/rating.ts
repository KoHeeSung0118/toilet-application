// pages/api/toilet/[id]/rating.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 ID' });
  }

  const db = (await connectDB).db('toilet_app');

  try {
    const toilet = await db.collection('toilets').findOne({ id });

    if (!toilet) {
      return res.status(404).json({ error: '화장실을 찾을 수 없습니다.' });
    }

    return res.status(200).json({
      avgRating: toilet.overallRating ?? 3.0, // 없으면 기본값 3.0
    });
  } catch (err) {
    console.error('🚨 별점 조회 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
