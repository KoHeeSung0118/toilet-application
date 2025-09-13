import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { emitToiletEvent } from '@/lib/pusher';

type Body = { signalId: string };
type ApiResp = { ok: true } | { error: string };

type DbDoc = {
  _id: ObjectId;
  toiletId: string;
  acceptedByUserId?: string | null;
  canceledAt?: Date;
  expiresAt: Date;
  acceptedAt?: Date;
};

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

  const { signalId } = req.body as Body;
  if (!signalId) {
    res.status(400).json({ error: 'Invalid payload' });
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
  const signals = db.collection<DbDoc>('signals');

  const now = new Date();
  const tenFromNow = new Date(now.getTime() + 10 * 60 * 1000);

  const rawResult = await signals.findOneAndUpdate(
    { _id, expiresAt: { $gt: now }, acceptedByUserId: userId },
    { $set: { acceptedByUserId: null }, $unset: { acceptedAt: '' }, $min: { expiresAt: tenFromNow } },
    { returnDocument: 'after' }
  );

  const doc = unwrapValue<DbDoc>(rawResult);
  if (!doc) {
    res.status(404).json({ error: 'Not Found or not rescuer' });
    return;
  }

  await emitToiletEvent(doc.toiletId, 'paper_accept_canceled', { signalId });

  res.status(200).json({ ok: true });
}
