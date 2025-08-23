import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type Item = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId: string | null;
  createdAt: string;
  expiresAt: string;
};

type ApiResp = { ok: true; items: Item[] };

// ✅ _id를 여기에 넣지 마세요. Mongo가 WithId<T>로 합쳐줍니다.
type DbDoc = {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId?: string | null;
  canceledAt?: Date;
  createdAt: Date;
  expiresAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'GET') return res.status(405).end();

  const uid = getUserFromTokenInAPI(req);

  const qp = req.query.toiletIds;
  const raw = Array.isArray(qp) ? qp.join(',') : (qp ?? '');
  const ids = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 100);

  if (!ids.length) return res.status(200).json({ ok: true, items: [] });

  const now = new Date();
  const client = await connectDB;
  const db = client.db('toilet');
  const signals = db.collection<DbDoc>('signals');

  const visibilityOr = uid
    ? [
        { acceptedByUserId: null },
        { acceptedByUserId: { $exists: false } },
        { userId: uid },
        { acceptedByUserId: uid },
      ]
    : [
        { acceptedByUserId: null },
        { acceptedByUserId: { $exists: false } },
      ];

  const docs: WithId<DbDoc>[] = await signals
    .find(
      {
        toiletId: { $in: ids },
        canceledAt: { $exists: false },
        expiresAt: { $gt: now },
        $or: visibilityOr,
      },
      {
        projection: {
          _id: 1, // 명시적으로 포함
          toiletId: 1,
          lat: 1,
          lng: 1,
          message: 1,
          userId: 1,
          acceptedByUserId: 1,
          createdAt: 1,
          expiresAt: 1,
        },
      }
    )
    .sort({ createdAt: -1 })
    .toArray();

  const items: Item[] = docs.map(d => ({
    _id: d._id.toHexString(), // ✅ 이제 타입이 확실해서 에러 없음
    toiletId: d.toiletId,
    lat: d.lat,
    lng: d.lng,
    message: d.message,
    userId: d.userId,
    acceptedByUserId: d.acceptedByUserId ?? null,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
  }));

  return res.status(200).json({ ok: true, items });
}
