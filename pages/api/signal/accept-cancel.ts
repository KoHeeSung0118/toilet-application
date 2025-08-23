import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type Body = { signalId: string };
type ApiResp = { ok: true } | { error: string };

type DbDoc = {
  _id: ObjectId;
  toiletId: string;
  acceptedByUserId?: string | null;
  canceledAt?: Date;
  expiresAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as Body;
  if (!signalId) return res.status(400).json({ error: 'Invalid payload' });

  const db = (await connectDB).db('toilet');
  const signals = db.collection<DbDoc>('signals');
  const now = new Date();

  const doc = await signals.findOne({ _id: new ObjectId(signalId) });
  if (!doc) return res.status(404).json({ error: 'Not Found' });
  if (doc.canceledAt || doc.expiresAt <= now) return res.status(400).json({ error: 'expired' });
  if (doc.acceptedByUserId !== userId) return res.status(403).json({ error: 'not_rescuer' });

  await signals.updateOne(
    { _id: doc._id, acceptedByUserId: userId },
    { $set: { acceptedByUserId: null }, $unset: { acceptedAt: '' } }
  );

  try {
    const io = getSocketServer((res.socket as any)?.server);
    const room = `toilet:${doc.toiletId}`;
    io.to(room).emit('paper_accept_canceled', { signalId });
    io.to(room).emit('signals_changed', { toiletId: doc.toiletId });
  } catch {}

  return res.status(200).json({ ok: true });
}
