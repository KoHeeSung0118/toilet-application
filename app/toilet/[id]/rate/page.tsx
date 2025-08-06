// pages/api/toilet/[id]/rate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

/** 한 사용자-별 별점 레코드 타입 */
export type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  /* ── 요청 파라미터 검사 ───────────────────────────── */
  const { id } = req.query;
  const { userId, overall, cleanliness, facility, convenience } = req.body;

  if (
    typeof id !== 'string' ||
    typeof userId !== 'string' ||
    typeof overall !== 'number' ||
    typeof cleanliness !== 'number' ||
    typeof facility !== 'number' ||
    typeof convenience !== 'number'
  ) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }

  /* ── DB 접속 ─────────────────────────────────────── */
  const db = (await connectDB).db('toilet_app');

  try {
    // 화장실 문서 조회 (ratingRecords 필드만 필요)
    const toilet = await db
      .collection<{ ratingRecords?: RatingRecord[] }>('toilets')
      .findOne({ id });

    if (!toilet) return res.status(404).json({ error: '화장실 없음' });

    const records: RatingRecord[] = toilet.ratingRecords ?? [];

    /* ── 기존 사용자 기록 찾기 ─────────────────────── */
    const index = records.findIndex((r: RatingRecord) => r.userId === userId);

    if (index !== -1) {
      // 수정
      records[index] = {
        ...records[index],
        overall,
        cleanliness,
        facility,
        convenience,
        createdAt: new Date(),
      };
    } else {
      // 새로 등록
      records.push({
        userId,
        overall,
        cleanliness,
        facility,
        convenience,
        createdAt: new Date(),
      });
    }

    /* ── 평균값 계산 ───────────────────────────────── */
    const avg = (field: keyof Omit<RatingRecord, 'userId' | 'createdAt'>) =>
      Math.round(
        records.reduce((sum, r) => sum + r[field], 0) / records.length * 10
      ) / 10;

    const updated = {
      $set: {
        ratingRecords: records,
        cleanliness: avg('cleanliness'),
        facility:     avg('facility'),
        convenience:  avg('convenience'),
        overallRating: avg('overall'),
      },
    };

    /* ── DB 업데이트 ───────────────────────────────── */
    await db.collection('toilets').updateOne({ id }, updated);

    return res
      .status(200)
      .json({ success: true, message: index !== -1 ? '수정됨' : '등록됨' });
  } catch (err) {
    console.error('🚨 별점 저장 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
