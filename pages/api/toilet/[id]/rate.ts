import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { overall, cleanliness, facility, convenience } = req.body;

  if (!id || !overall || !cleanliness || !facility || !convenience) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  const db = (await connectDB).db('toilet_app');

  try {
    // 1. 기존 데이터 가져오기
    const toilet = await db.collection('toilets').findOne({ id });

    // 2. 배열 초기화 or 기존 값 가져오기
    const cleanlinessRatings = toilet?.cleanlinessRatings ?? [];
    const facilityRatings = toilet?.facilityRatings ?? [];
    const convenienceRatings = toilet?.convenienceRatings ?? [];
    const overallRatings = toilet?.overallRatings ?? [];

    // 3. 새 별점 추가
    cleanlinessRatings.push(cleanliness);
    facilityRatings.push(facility);
    convenienceRatings.push(convenience);
    overallRatings.push(overall);

    // 4. 평균 계산
    const avg = (arr: number[]) =>
      arr.reduce((acc, cur) => acc + cur, 0) / arr.length;

    const updated = {
      $set: {
        cleanlinessRatings,
        facilityRatings,
        convenienceRatings,
        overallRatings,
        cleanliness: avg(cleanlinessRatings),
        facility: avg(facilityRatings),
        convenience: avg(convenienceRatings),
        overallRating: avg(overallRatings),
      },
      $setOnInsert: {
        id: id as string,
      },
    };

    // 5. 업데이트
    const result = await db.collection('toilets').updateOne(
      { id },
      updated,
      { upsert: true }
    );

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('🚨 별점 등록 실패:', err);
    return res.status(500).json({ error: '업데이트 실패' });
  }
}
