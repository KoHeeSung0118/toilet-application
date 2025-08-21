// pages/api/signal/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type ActiveItem = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId?: string | null;
  createdAt: string;
  expiresAt: string;
};

type ApiResp = { ok: true; items: ActiveItem[] } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const toiletIdsParam = req.query.toiletIds;
  const toiletIds = typeof toiletIdsParam === 'string' ? toiletIdsParam.split(',') : [];
  if (!toiletIds.length) return res.status(400).json({ error: 'toiletIds required' });

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const now = new Date();
  // expiresAt 이후 자동 숨김
  const cursor = signals.find({
    type: 'PAPER_REQUEST',
    toiletId: { $in: toiletIds },
    expiresAt: { $gt: now },
    // 수락된 건은 요청자/구원자만 볼 수 있도록
    $or: [
      { acceptedByUserId: { $exists: false } },
      { acceptedByUserId: null },
      { acceptedByUserId: userId },
      { userId },
    ],
  });

  const docs = await cursor.toArray();
  const items: ActiveItem[] = docs.map((d) => ({
    _id: d._id.toHexString(),
    toiletId: d.toiletId as string,
    lat: d.lat as number,
    lng: d.lng as number,
    message: d.message as string | undefined,
    userId: d.userId as string,
    acceptedByUserId: (d.acceptedByUserId as string | null | undefined) ?? null,
    createdAt: (d.createdAt as Date).toISOString(),
    expiresAt: (d.expiresAt as Date).toISOString(),
  }));

  return res.status(200).json({ ok: true, items });
}
