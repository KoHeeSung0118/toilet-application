import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { userId, overall, cleanliness, facility, convenience } = req.body;

  if (
    !id || !userId ||
    overall === undefined || cleanliness === undefined ||
    facility === undefined || convenience === undefined
  ) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  const db = (await connectDB).db('toilet_app');

  try {
    // 1. 화장실 정보 가져오기
    const toilet = await db.collection('toilets').findOne({ id });
    if (!toilet) return res.status(404).json({ error: '화장실 없음' });

    const records = toilet.ratingRecords ?? [];

    // 2. 기존 사용자 점수 있는지 확인
    const existingIndex = records.findIndex((r: any) => r.userId === userId);

    if (existingIndex !== -1) {
      // ✅ 수정
      records[existingIndex] = {
        ...records[existingIndex],
        overall,
        cleanliness,
        facility,
        convenience,
        createdAt: new Date(),
      };
    } else {
      // ✅ 새로 등록
      records.push({
        userId,
        overall,
        cleanliness,
        facility,
        convenience,
        createdAt: new Date(),
      });
    }

    // 3. 평균 계산
    const avg = (field: keyof typeof records[0]) =>
      Math.round(records.reduce((sum: number, r: any) => sum + r[field], 0) / records.length * 10) / 10;

    const updated = {
      $set: {
        ratingRecords: records,
        cleanliness: avg('cleanliness'),
        facility: avg('facility'),
        convenience: avg('convenience'),
        overallRating: avg('overall'),
      }
    };

    // 4. DB에 저장
    const result = await db.collection('toilets').updateOne({ id }, updated);

    return res.status(200).json({ success: true, message: existingIndex !== -1 ? '수정됨' : '등록됨' });
  } catch (err) {
    console.error('🚨 별점 저장 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
