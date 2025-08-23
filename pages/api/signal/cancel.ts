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
  canceledAt?: Date;
  expiresAt: Date;
};

/** findOneAndDelete 결과 unwrap */
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

  // 요청자가 자기 글을 취소 (아직 만료 전, 이미 취소 안된 것만)
  const rawResult = await signals.findOneAndDelete({
    _id,
    userId,
    canceledAt: { $exists: false },
    expiresAt: { $gt: now },
  });

  const deleted = unwrapValue<DbDoc>(rawResult);
  if (!deleted) {
    return res.status(409).json({ error: 'Not found or expired' });
  }

  try {
    // ✅ 타입 안전한 server 캐스팅
    const socketWithServer = res.socket as typeof res.socket & {
      server: HTTPServer;
    };

    const io = getSocketServer(socketWithServer.server);
    const room = `toilet:${deleted.toiletId}`;
    io.to(room).emit('paper_canceled', { signalId });
    io.to(room).emit('signals_changed', { toiletId: deleted.toiletId });
  } catch {
    // 소켓 서버 없을 수도 있음
  }

  return res.status(200).json({ ok: true });
}
