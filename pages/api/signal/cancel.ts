// pages/api/signal/cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp = { ok?: true; error?: string };

interface PaperSignalDoc {
  _id?: ObjectId;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;                // 요청자
  message?: string;
  createdAt: Date;
  expiresAt: Date;               // 자동 만료
  acceptedByUserId: string | null;
}

/** MongoDB findOneAndXXX 반환의 호환 처리: 객체(value) | 문서(null) */
function unwrapValue<T>(res: unknown): WithId<T> | null {
  if (res && typeof res === 'object') {
    if (Object.prototype.hasOwnProperty.call(res, 'value')) {
      const v = (res as { value?: WithId<T> | null }).value;
      return v ?? null;
    }
  }
  return (res as WithId<T> | null) ?? null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as { signalId?: string };
  if (!signalId) return res.status(400).json({ error: 'Invalid payload' });

  // ✅ ObjectId 유효성 검사
  let _id: ObjectId;
  try {
    _id = new ObjectId(signalId);
  } catch {
    return res.status(400).json({ error: 'Invalid signalId' });
  }

  const client = await connectDB;
  const db = client.db('toilet');
  const signals = db.collection<PaperSignalDoc>('signals');

  const now = new Date();

  // 요청자가 본인 글을 취소(아직 만료 전)
  const rawResult = await signals.findOneAndDelete({
    _id,
    userId,
    expiresAt: { $gt: now },
  });

  const deleted = unwrapValue<PaperSignalDoc>(rawResult);
  if (!deleted) return res.status(409).json({ error: 'Not found or expired' });

  try {
    const io = getSocketServer();
    io.to(`toilet:${deleted.toiletId}`).emit('signals_changed', {
      type: 'paper_canceled',
      signalId,
      toiletId: deleted.toiletId,
    });
  } catch {
    /* noop */
  }

  return res.status(200).json({ ok: true });
}
