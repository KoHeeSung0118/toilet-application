// pages/api/toilet/[id]/rating.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';

// 평균 재계산에 필요한 최소 타입만 정의
type RatingRecordLite = { overall?: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 ID' });
  }

  const db = (await connectDB).db('toilet_app');

  try {
    const toilet = await db.collection('toilets').findOne(
      { id },
      { projection: { overallRating: 1, ratingRecords: 1 } }
    );
    if (!toilet) {
      return res.status(404).json({ error: '화장실을 찾을 수 없습니다.' });
    }

    let avg: number | null =
      typeof toilet.overallRating === 'number' ? toilet.overallRating : null;

    // fallback 재계산 (여기서 any 제거)
    if (avg == null && Array.isArray(toilet.ratingRecords) && toilet.ratingRecords.length) {
      const records = toilet.ratingRecords as RatingRecordLite[];
      const sum = records.reduce((s, r) => s + Number(r.overall ?? 0), 0);
      avg = Math.round((sum / records.length) * 10) / 10;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ avgRating: avg ?? 3.0 });
  } catch (err) {
    console.error('🚨 별점 조회 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
