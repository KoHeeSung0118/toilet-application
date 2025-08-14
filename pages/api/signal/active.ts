// pages/api/signal/active.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { WithId } from 'mongodb';
import { connectDB } from '@/util/database';

/** DB에 저장되는 시그널 문서 타입 */
type SignalType = 'PAPER_REQUEST';

interface SignalDoc {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;
  type: SignalType;
  createdAt: Date;
  expiresAt: Date;
}

/** 클라이언트로 반환될 활성 시그널 타입 */
interface ActiveSignal {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  expiresAt: string; // ISO
}

type SuccessRes = { ok: true; items: ActiveSignal[] };
type ErrorRes = { error: string };

/** 쿼리스트링에서 toiletIds 파싱 (comma-separated) */
function parseToiletIds(input: string | string[] | undefined): string[] {
  if (!input) return [];
  const s = Array.isArray(input) ? input[0] : input;
  return s
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
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

    // 만료되지 않은 현재 활성 시그널만 조회
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
      createdAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
    }));

    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
