import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { emitSignalsChanged } from '@/util/socketServer';
import { ObjectId, WithId } from 'mongodb';

type ApiResp = { ok?: true; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'POST') return res.status(405).end();
  const { signalId } = req.body as { signalId: string };

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const sig = await signals.findOne({ _id: new ObjectId(signalId) }) as WithId<any> | null;
  if (!sig) return res.status(404).json({ error: 'Not found' });
  if (!sig.acceptedByUserId) return res.status(409).json({ error: 'Not accepted yet' });

  await signals.updateOne(
    { _id: sig._id },
    { $set: { acceptedByUserId: null, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } } // 다시 10분으로
  );

  emitSignalsChanged(sig.toiletId, { reason: 'accept_cancel', signalId });
  return res.status(200).json({ ok: true });
}
