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
  userId: string;
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
  const db = client.db('toilet');
  const signals = db.collection<DbDoc>('signals');
  const now = new Date();

  const newExpires = new Date(now.getTime() + 30 * 60 * 1000);

  const rawResult = await signals.findOneAndUpdate(
    {
      _id,
      userId: { $ne: userId },
      canceledAt: { $exists: false },
      expiresAt: { $gt: now },
      $or: [{ acceptedByUserId: null }, { acceptedByUserId: userId }],
    },
    {
      $set: { acceptedByUserId: userId, expiresAt: newExpires, acceptedAt: now },
    },
    { returnDocument: 'after' }
  );

  const updated = unwrapValue<DbDoc>(rawResult);
  if (!updated) {
    res.status(409).json({ error: 'Already accepted or expired' });
    return;
  }

  await emitToiletEvent(updated.toiletId, 'paper_accepted', {
    signalId,
    acceptedByUserId: userId,
  });

  res.status(200).json({ ok: true });
}
