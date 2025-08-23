// pages/api/toilet/[id]/rate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';

type RatingRecord = {
  userId: string;
  overall: number;
  cleanliness: number;
  facility: number;
  convenience: number;
  createdAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

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

  const client = await connectDB;
  const db = client.db('toilet_app');

  try {
    // 존재 확인(선택)
    const exists = await db.collection('toilets').findOne({ id });
    if (!exists) return res.status(404).json({ error: '화장실 없음' });

    // 💡 파이프라인 업데이트: 동일 userId 있으면 교체, 없으면 push → 평균 계산
    const now = new Date();
    const result = await db.collection('toilets').updateOne(
      { id },
      [
        // 1) ratingRecords가 없으면 빈 배열로
        { $set: { ratingRecords: { $ifNull: ['$ratingRecords', []] } } },

        // 2) 해당 userId의 인덱스 찾기
        {
          $set: {
            _idx: { $indexOfArray: ['$ratingRecords.userId', userId] },
          },
        },

        // 3) 있으면 그 자리 교체, 없으면 뒤에 추가
        {
          $set: {
            ratingRecords: {
              $cond: [
                { $ne: ['$_idx', -1] },
                {
                  $concatArrays: [
                    { $slice: ['$ratingRecords', '$_idx'] },
                    [
                      {
                        $mergeObjects: [
                          { $arrayElemAt: ['$ratingRecords', '$_idx'] },
                          {
                            userId,
                            overall,
                            cleanliness,
                            facility,
                            convenience,
                            createdAt: now,
                          },
                        ],
                      },
                    ],
                    {
                      $slice: [
                        '$ratingRecords',
                        { $add: ['$_idx', 1] },
                        { $size: '$ratingRecords' },
                      ],
                    },
                  ],
                },
                {
                  $concatArrays: [
                    '$ratingRecords',
                    [
                      {
                        userId,
                        overall,
                        cleanliness,
                        facility,
                        convenience,
                        createdAt: now,
                      } as RatingRecord,
                    ],
                  ],
                },
              ],
            },
          },
        },

        // 4) 평균 값 계산(소수 1자리 반올림)
        {
          $set: {
            overallRating: { $round: [{ $avg: '$ratingRecords.overall' }, 1] },
            cleanliness: { $round: [{ $avg: '$ratingRecords.cleanliness' }, 1] },
            facility: { $round: [{ $avg: '$ratingRecords.facility' }, 1] },
            convenience: { $round: [{ $avg: '$ratingRecords.convenience' }, 1] },
          },
        },

        // 5) 내부 계산용 필드 정리
        { $unset: '_idx' },
      ]
    );

    return res.status(200).json({
      success: true,
      message: result.matchedCount ? '저장됨' : '대상 없음',
    });
  } catch (err) {
    console.error('🚨 별점 저장 실패:', err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
