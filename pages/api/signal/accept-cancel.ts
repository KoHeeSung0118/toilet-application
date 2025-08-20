// pages/api/signal/accept-cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type Body = { id: string };
type OkRes = { ok: true; expiresAt: string };
type ErrRes = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkRes | ErrRes>
) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.body as Body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const now = new Date();
  const newExpires = new Date(now.getTime() + 10 * 60 * 1000); // 해제 시 10분 리셋
  const _id = new ObjectId(id);

  const updated = await signals.findOneAndUpdate(
    { _id, status: 'ACCEPTED', rescuerId: userId, acceptedExpiresAt: { $gt: now } },
    {
      $set: {
        status: 'OPEN',
        rescuerId: null,
        acceptedAt: null,
        acceptedExpiresAt: null,
        expiresAt: newExpires,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated || !updated.value) {
    return res.status(409).json({ error: 'Not accepted or permission denied' });
  }

  try {
    const io = getSocketServer();
    const v = updated.value as { _id: ObjectId; toiletId: string };
    io.to(`toilet:${v.toiletId}`).emit('paper_accept_cancelled', {
      _id: v._id.toHexString(),
      toiletId: v.toiletId,
      cancelledAt: now.toISOString(),
      expiresAt: newExpires.toISOString(),
      status: 'OPEN',
    });
  } catch {}

  return res.status(200).json({ ok: true, expiresAt: newExpires.toISOString() });
}
