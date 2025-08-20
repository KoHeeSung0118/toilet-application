// pages/api/signal/request-paper.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type ApiResp = { ok?: true; id?: string; expiresAt?: string; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).end();

  // 로그인 필수(미들웨어로 이미 강제라 가정하지만, 서버에서도 보호)
  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { toiletId, lat, lng, message } = req.body as {
    toiletId: string;
    lat: number;
    lng: number;
    message?: string;
  };

  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const text = (message ?? '').trim();
  const safeMsg = text.length > 0 ? text.slice(0, 120) : undefined;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 요청 기본 10분

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  // (1) 같은 유저의 미만료 요청이 이미 있으면 차단(전 화장실 공통)
  const already = await signals.findOne({
    requesterId: userId,
    expiresAt: { $gt: new Date() },
    type: 'PAPER_REQUEST',
  });
  if (already) {
    return res.status(409).json({ error: '이미 활성화된 요청이 있어요.' });
  }

  // (2) 스팸 쿨다운: 최근 60초 내 생성 이력 있으면 차단(전 화장실)
  const recent = await signals.findOne({
    requesterId: userId,
    createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    type: 'PAPER_REQUEST',
  });
  if (recent) {
    return res.status(429).json({ error: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const doc = {
    toiletId,
    lat,
    lng,
    requesterId: userId,
    acceptedBy: null as string | null,
    type: 'PAPER_REQUEST' as const,
    message: safeMsg,
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);

  // WebSocket 브로드캐스트 (해당 화장실 방 + ALL)
  try {
    const io = getSocketServer();
    const payload = {
      _id: result.insertedId.toHexString(),
      toiletId: doc.toiletId,
      lat: doc.lat,
      lng: doc.lng,
      message: doc.message ?? null,
      requesterId: doc.requesterId,
      acceptedBy: doc.acceptedBy,
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
      type: doc.type,
    };
    io.to(`toilet:${toiletId}`).to('toilet:ALL').emit('paper_request', payload);
  } catch {
    // dev 환경에서 소켓 미초기화 가능 → 무시
  }

  return res.status(201).json({ ok: true, id: result.insertedId.toHexString(), expiresAt: expiresAt.toISOString() });
}
