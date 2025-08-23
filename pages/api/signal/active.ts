import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
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

type DbDoc = {
  _id: ObjectId;
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
  const raw = (req.query.toiletIds as string | undefined) ?? '';
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return res.status(200).json({ ok: true, items: [] });

  const now = new Date();
  const db = (await connectDB).db('toilet');
  const signals = db.collection<DbDoc>('signals');

  const docs = await signals.find({
    toiletId: { $in: ids },
    canceledAt: { $exists: false },
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 }).toArray();

  // ✅ 수락된 요청은 요청자/구원자만 보이게
  const filtered = docs.filter(d => {
    const accepted = !!d.acceptedByUserId;
    if (!accepted) return true;
    if (!uid) return false;
    return d.userId === uid || d.acceptedByUserId === uid;
  });

  const items: Item[] = filtered.map(d => ({
    _id: d._id.toHexString(),
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
