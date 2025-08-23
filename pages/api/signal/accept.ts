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

  // 요청 찾기
  const sig = await signals.findOne({ _id: new ObjectId(signalId) }) as WithId<any> | null;
  if (!sig) return res.status(404).json({ error: 'Not found' });
  if (sig.expiresAt && new Date(sig.expiresAt) < new Date()) return res.status(410).json({ error: 'Expired' });
  if (sig.acceptedByUserId) return res.status(409).json({ error: 'Already accepted' });

  // 30분으로 연장 + 수락자 설정
  const newExpires = new Date(Date.now() + 30 * 60 * 1000);
  await signals.updateOne(
    { _id: sig._id },
    { $set: { acceptedByUserId: 'from-jwt', expiresAt: newExpires } } // 수락자 userId를 JWT에서 주입
  );

  emitSignalsChanged(sig.toiletId, { reason: 'accept', signalId });
  return res.status(200).json({ ok: true });
}
