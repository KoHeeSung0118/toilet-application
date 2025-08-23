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
  userId: string;
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

  // ✅ ObjectId 유효성 검사
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

  // 30분 연장
  const newExpires = new Date(now.getTime() + 30 * 60 * 1000);

  const rawResult = await signals.findOneAndUpdate(
    {
      _id,
      userId: { $ne: userId }, // 자기 요청은 수락 불가
      canceledAt: { $exists: false },
      expiresAt: { $gt: now },
      $or: [{ acceptedByUserId: null }, { acceptedByUserId: userId }],
    },
    {
      $set: {
        acceptedByUserId: userId,
        expiresAt: newExpires,
        acceptedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  const updated = unwrapValue<DbDoc>(rawResult);
  if (!updated) {
    return res.status(409).json({ error: 'Already accepted or expired' });
  }

  try {
    // ✅ 타입 안전한 server 캐스팅
    const socketWithServer = res.socket as typeof res.socket & {
      server: HTTPServer;
    };

    const io = getSocketServer(socketWithServer.server);
    const room = `toilet:${updated.toiletId}`;
    io.to(room).emit('paper_accepted', {
      signalId,
      acceptedByUserId: userId,
    });
    io.to(room).emit('signals_changed', { toiletId: updated.toiletId });
  } catch {
    // 소켓 서버가 없을 수도 있음
  }

  return res.status(200).json({ ok: true });
}
