// pages/api/signal/accept-cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb'; // ✅ lib/mongodb.ts의 clientPromise 사용
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp = { ok?: true; error?: string };

interface PaperSignalDoc {
  _id?: ObjectId;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;
  message?: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedByUserId: string | null;
}

// findOneAndUpdate 드라이버 버전별 대응
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

  // ✅ ObjectId 형식 방어
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

  const rawResult = await signals.findOneAndUpdate(
    {
      _id,
      expiresAt: { $gt: now },
      acceptedByUserId: userId, // 내가 수락한 건만 취소 가능
    },
    { $set: { acceptedByUserId: null } },
    { returnDocument: 'after' }
  );

  const updated = unwrapValue<PaperSignalDoc>(rawResult);
  if (!updated) return res.status(409).json({ error: 'Not accepted by you or expired' });

  try {
    const io = getSocketServer();
    io.to(`toilet:${updated.toiletId}`).emit('signals_changed', {
      type: 'paper_accept_canceled',
      signalId,
      toiletId: updated.toiletId,
    });
  } catch {
    /* noop */
  }

  return res.status(200).json({ ok: true });
}
