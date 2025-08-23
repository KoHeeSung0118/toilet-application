import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import connectDB from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type Body = { signalId: string };
type ApiResp = { ok: true } | { error: string };

type DbDoc = {
  _id: ObjectId;
  toiletId: string;
  acceptedByUserId?: string | null;
  canceledAt?: Date;
  expiresAt: Date;
  acceptedAt?: Date;
};

/** findOneAndUpdate 결과 unwrap */
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

  const { signalId } = req.body as Body;
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
  const signals = db.collection<DbDoc>('signals');

  const now = new Date();
  const tenFromNow = new Date(now.getTime() + 10 * 60 * 1000);

  // 내가 수락한 건만 취소 가능 + 만료 시간은 (현재, now+10분) 중 더 작은 값으로 줄임
  const rawResult = await signals.findOneAndUpdate(
    {
      _id,
      expiresAt: { $gt: now },
      acceptedByUserId: userId,
    },
    {
      $set: { acceptedByUserId: null },
      $unset: { acceptedAt: '' },
      $min: { expiresAt: tenFromNow }, // 🔹 여기서 "최대 10분"으로 캡
    },
    { returnDocument: 'after' }
  );

  const doc = unwrapValue<DbDoc>(rawResult);
  if (!doc) return res.status(404).json({ error: 'Not Found or not rescuer' });

  try {
    // ✅ res.socket.server 타입 안전하게 접근
    const socketWithServer = res.socket as typeof res.socket & {
      server: HTTPServer;
    };

    const io = getSocketServer(socketWithServer.server);
    const room = `toilet:${doc.toiletId}`;
    io.to(room).emit('paper_accept_canceled', { signalId });
    io.to(room).emit('signals_changed', { toiletId: doc.toiletId });
  } catch {
    // 소켓 서버 없음
  }

  return res.status(200).json({ ok: true });
}
