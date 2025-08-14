// pages/api/signal/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

type ActiveSignal = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;
  type: 'PAPER_REQUEST';
  createdAt: string;   // ISO
  expiresAt: string;   // ISO
};

// GET /api/signal/active?toiletIds=1,2,3
// (선택) GET /api/signal/active?since=ISO_STRING  // 기본: 지금-2분
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ items?: ActiveSignal[]; error?: string }>
) {
  if (req.method !== 'GET') return res.status(405).end();

  const client = await connectDB;
  const db = client.db('toilet');
  const col = db.collection('signals');

  const idsParam = (req.query.toiletIds as string | undefined) ?? '';
  const toiletIds = idsParam.split(',').map(s => s.trim()).filter(Boolean);

  const sinceParam = req.query.since as string | undefined;
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 2 * 60 * 1000);

  const now = new Date();

  const q: any = {
    type: 'PAPER_REQUEST',
    expiresAt: { $gt: now },       // 아직 유효한 신호만
    createdAt: { $gte: since },    // 최근 발생(기본 2분)
  };
  if (toiletIds.length) q.toiletId = { $in: toiletIds };

  const docs = await col
    .find(q, { projection: { /* 모두 필요 */ } })
    .limit(200)
    .toArray();

  const items: ActiveSignal[] = docs.map((d: any) => ({
    _id: d._id.toHexString(),
    toiletId: d.toiletId,
    lat: d.lat,
    lng: d.lng,
    userId: d.userId ?? null,
    type: d.type,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
  }));

  return res.status(200).json({ items });
}
