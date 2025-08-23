import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

type PostBody = { toiletId: string; lat: number; lng: number; message?: string };
type ApiResp = { ok: true; id: string; expiresAt: string } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { toiletId, lat, lng, message = '' } = req.body as PostBody;
  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const msg = String(message || '').slice(0, 120);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 기본 10분

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  // ✅ 사용자 단일 활성 요청 강제 (전 화장실)
  const existing = await signals.findOne({
    userId,
    canceledAt: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (existing) {
    return res.status(409).json({ error: 'already_active' });
  }

  const doc = {
    toiletId,
    lat,
    lng,
    userId,
    message: msg,
    type: 'PAPER_REQUEST' as const,
    createdAt: now,
    expiresAt,
    acceptedByUserId: null as string | null,
  };

  const result = await signals.insertOne(doc);

  try {
    const io = getSocketServer((res.socket as any)?.server);
    const room = `toilet:${toiletId}`;
    io.to(room).emit('paper_request', {
      _id: result.insertedId.toHexString(),
      toiletId,
      lat,
      lng,
      message: msg,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      acceptedByUserId: null,
    });
    io.to(room).emit('signals_changed', { toiletId });
  } catch {
    // dev에서 초기화 전이면 무시
  }

  return res.status(201).json({ ok: true, id: result.insertedId.toHexString(), expiresAt: expiresAt.toISOString() });
}
