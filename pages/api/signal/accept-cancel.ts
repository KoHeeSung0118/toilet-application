import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type Resp = { ok: true } | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as { signalId: string };
  if (!signalId) return res.status(400).json({ error: 'Missing signalId' });

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const sig = await signals.findOne({ _id: new ObjectId(signalId) });
  if (!sig) return res.status(404).json({ error: 'Not found' });
  if (sig.acceptedByUserId !== userId) return res.status(403).json({ error: 'Not your acceptance' });

  const result = await signals.updateOne(
    { _id: new ObjectId(signalId) },
    { $set: { acceptedByUserId: null }, $unset: { acceptedAt: '' } }
  );
  if (result.matchedCount === 0) return res.status(409).json({ error: 'Update failed' });

  try {
    const io = getSocketServer();
    const room = `toilet:${String(sig.toiletId)}`;
    io.to(room).emit('paper_accept_canceled', {
      signalId,
      toiletId: String(sig.toiletId),
    });
  } catch {}

  return res.status(200).json({ ok: true });
}
