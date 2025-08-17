import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type SuccessRes = { ok: true };
type ErrorRes = { error: string };
type CancelBody = { id: string };

type SignalDoc = {
  _id: ObjectId;
  toiletId: string;
  userId: string;
  type: 'PAPER_REQUEST';
  createdAt: Date;
  expiresAt: Date;
  cancelledAt?: Date;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessRes | ErrorRes>
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 로그인은 미들웨어로 보장, 그래도 방어적으로 확인
  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // 바디 파싱
  const body: CancelBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const id = body?.id;
  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid signal id' });
  }

  const db = (await connectDB).db('toilet');
  const col = db.collection<SignalDoc>('signals');

  const now = new Date();

  // ✅ 내 소유의 "활성" 신호만 취소 가능
  const signal = await col.findOne({
    _id: new ObjectId(id),
    userId,
    type: 'PAPER_REQUEST',
    expiresAt: { $gt: now },
    cancelledAt: { $exists: false },
  });

  if (!signal) {
    return res.status(404).json({ error: 'Not found or not yours' });
  }

  await col.updateOne(
    { _id: signal._id },
    { $set: { cancelledAt: now, expiresAt: now } }
  );

  // 같은 화장실 방에 취소 이벤트 브로드캐스트(선택)
  try {
    const io = getSocketServer();
    io.to(`toilet:${signal.toiletId}`).emit('paper_request_cancelled', {
      _id: signal._id.toHexString(),
      toiletId: signal.toiletId,
      cancelledAt: now.toISOString(),
    });
  } catch {
    // dev에서 소켓 미초기화 시 무시
  }

  return res.status(200).json({ ok: true });
}
