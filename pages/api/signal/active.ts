// pages/api/signal/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

type ActiveItem = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  createdAt: string;
  expiresAt: string;
  requesterId: string;
  acceptedBy?: string | null;
};

type ApiResp = { ok?: true; items?: ActiveItem[]; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'GET') return res.status(405).end();

  const idsCsv = req.query.toiletIds;
  if (!idsCsv || typeof idsCsv !== 'string') {
    return res.status(400).json({ error: 'toiletIds query is required' });
  }
  const toiletIds = idsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  if (toiletIds.length === 0) return res.status(200).json({ ok: true, items: [] });

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const now = new Date();

  const docs = await signals
    .find({
      toiletId: { $in: toiletIds },
      expiresAt: { $gt: now },
      type: 'PAPER_REQUEST',
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const items: ActiveItem[] = docs.map((d) => ({
    _id: d._id.toHexString(),
    toiletId: d.toiletId,
    lat: d.lat,
    lng: d.lng,
    message: d.message,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
    requesterId: d.requesterId,
    acceptedBy: d.acceptedBy ?? null,
  }));

  return res.status(200).json({ ok: true, items });
}
