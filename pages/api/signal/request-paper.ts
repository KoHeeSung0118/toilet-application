import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { emitSignalsChanged, getSocketServer } from '@/util/socketServer';

type Body = {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
};

type ApiResp = { ok?: true; id?: string; expiresAt?: string; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  if (req.method !== 'POST') return res.status(405).end();

  const { toiletId, lat, lng, message } = req.body as Body;
  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 기본 10분

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  // 동일 요청자/화장실 중복 방지(원하면 조건 조정)
  // const recent = await signals.findOne({ toiletId, userId, expiresAt: { $gt: now } });
  // if (recent) return res.status(409).json({ error: '이미 활성화된 요청이 있습니다.' });

  const doc = {
    toiletId: String(toiletId),
    lat,
    lng,
    message: (message ?? '').slice(0, 120),
    type: 'PAPER_REQUEST' as const,
    userId: 'from-jwt', // 미들웨어로 로그인 강제라면 서버에서 jwt 해석해서 넣으세요
    acceptedByUserId: null as string | null,
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);

  // 🔔 통일: 변경 발생 시 signals_changed
  try {
    getSocketServer(); // 보장용
    emitSignalsChanged(doc.toiletId, { reason: 'create' });
  } catch {}

  return res.status(201).json({ ok: true, id: result.insertedId.toHexString(), expiresAt: expiresAt.toISOString() });
}
