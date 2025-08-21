// pages/api/signal/accept-cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type ApiResp =
  | { ok: true; id: string; reopensUntil: string }
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
  const reopenUntil = new Date(now.getTime() + 10 * 60 * 1000); // 취소 시 10분 다시 공개

  // 내가 수락했던 글만 취소 가능 + 아직 만료 안 됨
  const result = await signals.updateOne(
    {
      _id: new ObjectId(signalId),
      expiresAt: { $gt: now },
      acceptedByUserId: userId,
    },
    {
      $unset: {
        acceptedByUserId: '',
        acceptedAt: '',
      },
      $set: {
        expiresAt: reopenUntil,
      },
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Not found or expired or not your accept' });
  }
  if (result.modifiedCount === 0) {
    return res.status(409).json({ error: 'Cancel failed' });
  }

  // 브로드캐스트(다시 공개되었음을 알림)
  try {
    const doc = await signals.findOne({ _id: new ObjectId(signalId) });
    const io = getSocketServer();
    const toiletId = (doc?.toiletId ?? '') as string;

    io.to(`toilet:${toiletId}`).emit('paper_accept_canceled', {
      _id: signalId,
      toiletId,
      reopensUntil: reopenUntil.toISOString(),
    });
    io.to('toilet:ALL').emit('paper_accept_canceled', {
      _id: signalId,
      toiletId,
      reopensUntil: reopenUntil.toISOString(),
    });
  } catch {
    // 소켓 초기화 전이면 무시
  }

  return res.status(200).json({ ok: true, id: signalId, reopensUntil: reopenUntil.toISOString() });
}
