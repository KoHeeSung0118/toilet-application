// pages/api/signal/accept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp =
  | { ok: true; id: string; acceptExpiresAt: string }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { signalId } = req.body as { signalId?: string };
  if (!signalId || !ObjectId.isValid(signalId)) {
    return res.status(400).json({ error: 'Invalid signalId' });
  }

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  const now = new Date();
  const acceptExpiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30분

  // 아직 만료되지 않았고, 다른 사람이 이미 수락하지 않은 글만 수락 가능
  const result = await signals.updateOne(
    {
      _id: new ObjectId(signalId),
      expiresAt: { $gt: now },
      $or: [{ acceptedByUserId: null }, { acceptedByUserId: { $exists: false } }],
    },
    {
      $set: {
        acceptedByUserId: userId,
        acceptedAt: now,
        expiresAt: acceptExpiresAt, // 30분으로 타이머 갱신
      },
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Not found or already expired' });
  }
  if (result.modifiedCount === 0) {
    // 조건은 맞았는데 변경이 안 됨 → 경쟁 상태 등
    return res.status(409).json({ error: 'Already accepted by someone' });
  }

  // 소켓 브로드캐스트(해당 화장실 방 + ALL)
  try {
    const doc = await signals.findOne({ _id: new ObjectId(signalId) });
    const io = getSocketServer();
    const toiletId = (doc?.toiletId ?? '') as string;

    io.to(`toilet:${toiletId}`).emit('paper_accepted', {
      _id: signalId,
      toiletId,
      acceptedByUserId: userId,
      acceptExpiresAt: acceptExpiresAt.toISOString(),
    });
    io.to('toilet:ALL').emit('paper_accepted', {
      _id: signalId,
      toiletId,
      acceptedByUserId: userId,
      acceptExpiresAt: acceptExpiresAt.toISOString(),
    });
  } catch {
    // 소켓 초기화 전이면 무시
  }

  return res.status(200).json({ ok: true, id: signalId, acceptExpiresAt: acceptExpiresAt.toISOString() });
}
