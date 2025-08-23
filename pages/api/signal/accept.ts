// pages/api/signal/accept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type AcceptBody = { signalId: string };
type ApiResp = { ok: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as AcceptBody;
  if (!signalId) return res.status(400).json({ error: 'Missing signalId' });

  try {
    const db = (await connectDB).db('toilet');
    const signals = db.collection('signals');

    const _id = new ObjectId(signalId);
    const sig = await signals.findOne({ _id });
    if (!sig) return res.status(404).json({ error: 'Not found' });

    // 만료 체크
    const now = new Date();
    if (sig.expiresAt instanceof Date && sig.expiresAt.getTime() <= now.getTime()) {
      return res.status(410).json({ error: 'Already expired' });
    }

    // 이미 다른 사람이 수락했으면 불가
    if (sig.acceptedByUserId && sig.acceptedByUserId !== userId) {
      return res.status(409).json({ error: 'Already accepted' });
    }

    const acceptedUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30분

    const upd = await signals.updateOne(
      { _id },
      { $set: { acceptedByUserId: userId, acceptedUntil } }
    );
    if (!upd.modifiedCount) {
      return res.status(500).json({ error: 'Update failed' });
    }

    // 지도/디테일 실시간 동기화
    try {
      const io = getSocketServer();
      io.to(`toilet:${sig.toiletId}`).emit('signals_changed', { toiletId: String(sig.toiletId) });
      io.emit('signals_changed', { toiletId: String(sig.toiletId) }); // 안전망(옵션)
    } catch {
      // dev 환경에서 socket 미초기화면 무시
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
