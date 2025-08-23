// pages/api/signal/accept-cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type CancelBody = { signalId: string };
type ApiResp = { ok: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as CancelBody;
  if (!signalId) return res.status(400).json({ error: 'Missing signalId' });

  try {
    const db = (await connectDB).db('toilet');
    const signals = db.collection('signals');

    const _id = new ObjectId(signalId);
    const sig = await signals.findOne({ _id });
    if (!sig) return res.status(404).json({ error: 'Not found' });

    if (sig.acceptedByUserId !== userId) {
      return res.status(403).json({ error: 'Not accepted by you' });
    }

    const upd = await signals.updateOne(
      { _id },
      { $set: { acceptedByUserId: null, acceptedUntil: null } }
    );
    if (!upd.modifiedCount) return res.status(500).json({ error: 'Update failed' });

    try {
      const io = getSocketServer();
      io.to(`toilet:${sig.toiletId}`).emit('signals_changed', { toiletId: String(sig.toiletId) });
      io.emit('signals_changed', { toiletId: String(sig.toiletId) });
    } catch {
      // ignore
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
