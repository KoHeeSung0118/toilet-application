import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type Resp = { ok: true; signalId: string; expiresAt: string } | { error: string };

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
  if (sig.expiresAt && sig.expiresAt < new Date()) return res.status(409).json({ error: 'Expired' });
  if (sig.acceptedByUserId && sig.acceptedByUserId !== userId) {
    return res.status(409).json({ error: 'Already accepted' });
  }

  const now = new Date();
  const newExpires = new Date(now.getTime() + 30 * 60 * 1000);

  const result = await signals.updateOne(
    { _id: new ObjectId(signalId), expiresAt: { $gt: now } },
    {
      $set: {
        acceptedByUserId: userId,
        acceptedAt: now,
        expiresAt: newExpires,
      },
    }
  );
  if (result.matchedCount === 0) return res.status(409).json({ error: 'Already accepted or expired' });

  try {
    const io = getSocketServer();
    const room = `toilet:${String(sig.toiletId)}`;
    io.to(room).emit('paper_accepted', {
      signalId,
      toiletId: String(sig.toiletId),
      acceptedByUserId: userId,
      expiresAt: newExpires.toISOString(),
    });
  } catch {}

  return res.status(200).json({ ok: true, signalId, expiresAt: newExpires.toISOString() });
}
