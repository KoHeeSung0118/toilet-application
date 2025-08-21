// pages/api/signal/request-paper.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

type ApiResp =
  | { ok: true; id: string; expiresAt: string }
  | { error: string };

type Body = {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { toiletId, lat, lng, message } = (req.body ?? {}) as Body;

  // 기본 검증
  if (!toiletId || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = new Date();
  const EXPIRE_MS = 10 * 60 * 1000; // 기본 10분
  const expiresAt = new Date(now.getTime() + EXPIRE_MS);

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  // ✅ TTL 인덱스 보장 (이미 있으면 noop)
  await signals.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  // ✅ 진짜 "활성"만 막기: 아직 만료되지 않았고, 취소/완료가 아닌 것
  // 상태 필드가 없다면 기본값 'active'로 취급되므로 조건을 status!=canceled 로 둡니다.
  const existing = await signals.findOne({
    userId,
    type: 'PAPER_REQUEST',
    expiresAt: { $gt: now },
    status: { $nin: ['canceled', 'completed'] }, // accepted도 막으려면 여기 포함 x (accepted는 여전히 활성)
  });

  if (existing) {
    return res.status(409).json({ error: '이미 활성화된 요청이 있어요. 기존 요청이 만료되거나 취소된 후 다시 시도해 주세요.' });
  }

  // 문서 생성
  const doc = {
    type: 'PAPER_REQUEST' as const,
    toiletId,
    lat,
    lng,
    userId,
    message: (message ?? '').slice(0, 120), // 120자 제한
    status: 'active' as const,              // 상태 필드 명시
    acceptedByUserId: null as string | null,
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);

  // 웹소켓 브로드캐스트 (방 기준)
  try {
    const io = getSocketServer();
    const payload = {
      _id: result.insertedId.toHexString(),
      toiletId: doc.toiletId,
      lat: doc.lat,
      lng: doc.lng,
      message: doc.message,
      userId: doc.userId,
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
      status: doc.status,
    };
    io.to(`toilet:${toiletId}`).emit('paper_request', payload);
    io.to('toilet:ALL').emit('paper_request', payload); // 필요 없으면 제거
  } catch {
    // dev에서 소켓 미초기화면 무시
  }

  return res.status(201).json({
    ok: true,
    id: result.insertedId.toHexString(),
    expiresAt: expiresAt.toISOString(),
  });
}
