// pages/api/signal/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { WithId } from 'mongodb';
import { connectDB } from '@/util/database';

type SignalType = 'PAPER_REQUEST';
interface SignalDoc {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;
  type: SignalType;
  message?: string;     // ✅ 추가
  createdAt: Date;
  expiresAt: Date;
}

interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;     // ✅ 추가
  createdAt: string;
  expiresAt: string;
}

type SuccessRes = { ok: true; items: ActiveSignal[] };
type ErrorRes = { error: string };

function parseToiletIds(input: string | string[] | undefined): string[] {
  if (!input) return [];
  const s = Array.isArray(input) ? input[0] : input;
  return s.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessRes | ErrorRes>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const toiletIds = parseToiletIds(req.query.toiletIds);
    if (toiletIds.length === 0) {
      return res.status(200).json({ ok: true, items: [] });
    }

    const now = new Date();
    const db = (await connectDB).db('toilet');
    const signalsCol = db.collection<SignalDoc>('signals');

    const docs = await signalsCol
      .find({
        toiletId: { $in: toiletIds },
        type: 'PAPER_REQUEST',
        expiresAt: { $gt: now },
      })
      .project<WithId<SignalDoc>>({
        toiletId: 1,
        lat: 1,
        lng: 1,
        message: 1,     // ✅ 포함
        createdAt: 1,
        expiresAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const items: ActiveSignal[] = docs.map((d) => ({
      _id: d._id.toHexString(),
      toiletId: d.toiletId,
      lat: d.lat,
      lng: d.lng,
      message: d.message,
      createdAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
    }));

    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
