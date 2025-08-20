// pages/api/signal/unaccept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp = { ok?: true; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as { signalId: string };
  if (!signalId) return res.status(400).json({ error: 'signalId required' });

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const _id = new ObjectId(signalId);
  const doc = await signals.findOne({ _id });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.acceptedBy !== userId) return res.status(403).json({ error: 'Not your acceptance' });

  // 수락 취소 → acceptedBy null + 10분 타이머 재부여
  const newExpires = new Date(Date.now() + 10 * 60 * 1000);
  await signals.updateOne(
    { _id },
    { $set: { acceptedBy: null, expiresAt: newExpires } }
  );

  try {
    const io = getSocketServer();
    io.to(`toilet:${doc.toiletId}`).to('toilet:ALL').emit('paper_unaccept', {
      _id: signalId,
      acceptedBy: null,
      expiresAt: newExpires.toISOString(),
    });
  } catch {}

  return res.status(200).json({ ok: true });
}
