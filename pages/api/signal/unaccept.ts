import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { emitToiletEvent } from '@/lib/pusher';

type ApiResp = { ok?: true; error?: string };

interface PaperSignalDoc {
  _id?: ObjectId;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;
  message?: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedByUserId: string | null;
}

function unwrapValue<T>(res: unknown): WithId<T> | null {
  if (res && typeof res === 'object' && Object.prototype.hasOwnProperty.call(res, 'value')) {
    const v = (res as { value?: WithId<T> | null }).value;
    return v ?? null;
  }
  return (res as WithId<T> | null) ?? null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const userId = getUserFromTokenInAPI(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { signalId } = req.body as { signalId?: string };
  if (!signalId) {
    res.status(400).json({ error: 'signalId required' });
    return;
  }

  let _id: ObjectId;
  try {
    _id = new ObjectId(signalId);
  } catch {
    res.status(400).json({ error: 'Invalid signalId' });
    return;
  }

  const client = await connectDB;
  const db = client.db(process.env.MONGODB_DB ?? 'toilet_app');
  const signals = db.collection<PaperSignalDoc>('signals');

  const now = new Date();
  const newExpires = new Date(now.getTime() + 10 * 60 * 1000);

  const raw = await signals.findOneAndUpdate(
    { _id, acceptedByUserId: userId, expiresAt: { $gt: now } },
    { $set: { acceptedByUserId: null, expiresAt: newExpires } },
    { returnDocument: 'after' }
  );

  const updated = unwrapValue<PaperSignalDoc>(raw);
  if (!updated) {
    res.status(409).json({ error: 'Not your acceptance or expired' });
    return;
  }

  await emitToiletEvent(updated.toiletId, 'paper_unaccepted', {
    signalId,
    toiletId: updated.toiletId,
    acceptedByUserId: null,
    expiresAt: newExpires.toISOString(),
  });

  res.status(200).json({ ok: true });
}
