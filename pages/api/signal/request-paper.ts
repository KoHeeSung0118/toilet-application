// pages/api/signal/request-paper.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';

/** 요청 바디 타입(이 파일 안에서만 사용) */
type PaperRequestBody = {
  toiletId: string;
  lat: number;
  lng: number;
  userId?: string | null;
};

/** 웹소켓으로 뿌릴 페이로드 타입(와이어 포맷) */
type PaperSignalPayload = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;
  type: 'PAPER_REQUEST';
  createdAt: string;   // ISO string
  expiresAt: string;   // ISO string
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok?: true; id?: string; expiresAt?: string; error?: string }>
) {
  if (req.method !== 'POST') return res.status(405).end();

  const { toiletId, lat, lng, userId } = req.body as PaperRequestBody;

  // 기본 검증
  if (
    !toiletId ||
    typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng)
  ) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2분

  const db = (await connectDB).db('toilet');
  const signals = db.collection('signals');

  // 간단한 쿨다운(동일 유저/화장실 60초 제한)
  if (userId) {
    const recent = await signals.findOne({
      userId,
      toiletId,
      type: 'PAPER_REQUEST',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recent) return res.status(429).json({ error: 'Too many requests' });
  }

  const doc = {
    toiletId,
    lat,
    lng,
    userId: userId ?? null,
    type: 'PAPER_REQUEST' as const,
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);

  // 웹소켓 브로드캐스트
  try {
    const io = getSocketServer();
    const payload: PaperSignalPayload = {
      _id: result.insertedId.toHexString(),
      toiletId: doc.toiletId,
      lat: doc.lat,
      lng: doc.lng,
      userId: doc.userId,
      type: doc.type,
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
    };

    // 방 기반 브로드캐스트 (클라이언트가 join_toilet(toiletId) 되어 있어야 수신)
    const room = `toilet:${toiletId}`;
    console.log('🚀 EMIT paper_request ->', room, { lat: doc.lat, lng: doc.lng });
    io.to(room).emit('paper_request', payload);

    io.to('toilet:ALL').emit('paper_request', payload);
    // 전역 테스트가 필요하면 위 한 줄 대신 아래를 임시로 사용:
    // io.emit('paper_request', payload);
  } catch {
    // 소켓 서버가 아직 초기화되지 않았으면(개발 중) 그냥 패스
  }

  return res.status(201).json({
    ok: true,
    id: result.insertedId.toHexString(),
    expiresAt: expiresAt.toISOString(),
  });
}
