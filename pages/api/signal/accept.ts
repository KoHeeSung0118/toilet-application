// pages/api/signal/accept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb'; // ✅ lib/mongodb.ts를 바로 사용
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp = { ok?: true; error?: string };

interface PaperSignalDoc {
  _id?: ObjectId;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string;                 // 요청자
  message?: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedByUserId: string | null; // 구원자
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

  // ✅ ObjectId 형식 유효성 방어
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
  const thirtyMin = 30 * 60 * 1000;

  const rawResult = await signals.findOneAndUpdate(
    {
      _id,
      expiresAt: { $gt: now },
      acceptedByUserId: null, // 아직 아무도 수락X
    },
    {
      $set: {
        acceptedByUserId: userId,
        expiresAt: new Date(now.getTime() + thirtyMin), // 구원자 수락 시 30분 연장
      },
    },
    { returnDocument: 'after' }
  );

  const updated = unwrapValue<PaperSignalDoc>(rawResult);
  if (!updated) {
    return res.status(409).json({ error: 'Already accepted or expired' });
  }

  // 소켓 알림 (실패해도 요청은 성공 처리)
  try {
    const io = getSocketServer();
    io.to(`toilet:${updated.toiletId}`).emit('signals_changed', {
      type: 'paper_accepted',
      signalId,
      toiletId: updated.toiletId,
      acceptedByUserId: userId,
      expiresAt: updated.expiresAt.toISOString(),
    });
  } catch {
    /* noop */
  }

  return res.status(200).json({ ok: true });
}
