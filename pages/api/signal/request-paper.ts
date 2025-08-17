import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type PaperRequestBody = {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
};

type SuccessRes = { ok: true; id: string; expiresAt: string };
type ErrorRes = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessRes | ErrorRes>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 로그인 전제 — 미들웨어가 토큰 보장, 혹시 몰라서 한번 더 체크
  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const body: PaperRequestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { toiletId, lat, lng } = body;

  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const message = (body.message ?? '').toString().trim().slice(0, 120);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2분

  const db = (await connectDB).db('toilet');
  const signals = db.collection<{
    toiletId: string;
    lat: number;
    lng: number;
    userId: string;
    type: 'PAPER_REQUEST';
    message?: string;
    createdAt: Date;
    expiresAt: Date;
    cancelledAt?: Date;
  }>('signals');

  // ✅ 같은 사용자 동시 1건 제한 (화장실 상관없이)
  const existing = await signals.findOne({
    type: 'PAPER_REQUEST',
    userId,
    expiresAt: { $gt: now },
    cancelledAt: { $exists: false },
  });
  if (existing) return res.status(429).json({ error: '이미 활성화된 요청이 있습니다.' });

  const doc = {
    toiletId,
    lat,
    lng,
    userId,
    type: 'PAPER_REQUEST' as const,
    message: message.length ? message : undefined,
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);

  // 화장실 방으로 브로드캐스트
  try {
    const io = getSocketServer();
    io.to(`toilet:${toiletId}`).emit('paper_request', {
      _id: result.insertedId.toHexString(),
      toiletId,
      lat,
      lng,
      message: doc.message ?? null,
      type: 'PAPER_REQUEST',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    // dev에서 소켓 미초기화는 무시
  }

  return res.status(201).json({ ok: true, id: result.insertedId.toHexString(), expiresAt: expiresAt.toISOString() });
}
