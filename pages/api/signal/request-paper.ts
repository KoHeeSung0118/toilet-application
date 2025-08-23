import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import type { InsertOneResult } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { getSocketServer } from '@/util/socketServer';

interface ApiResp {
  ok?: true;
  id?: string;
  expiresAt?: string;
  error?: string;
}

interface Body {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
}

interface PaperSignalDoc {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string | null;
  userId: string;
  acceptedByUserId?: string | null;
  createdAt: Date;
  expiresAt: Date;
  type: 'PAPER_REQUEST';
  canceledAt?: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { toiletId, lat, lng, message } = req.body as Body;

  // ✅ 기본 유효성
  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  // 메시지 정리
  const cleanMsg =
    typeof message === 'string' ? message.trim().slice(0, 120) : undefined;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10분

  const client = await connectDB;
  const db = client.db('toilet');
  const signals = db.collection<PaperSignalDoc>('signals');

  // ✅ 사용자 단일 활성 요청 제한 (전 화장실 공통)
  const existing = await signals.findOne({
    userId,
    canceledAt: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (existing) {
    return res.status(409).json({ error: 'already_active' });
  }

  const doc: PaperSignalDoc = {
    toiletId,
    lat,
    lng,
    message: cleanMsg ?? null,
    userId,
    type: 'PAPER_REQUEST',
    createdAt: now,
    expiresAt,
    acceptedByUserId: null,
  };

  const result: InsertOneResult<PaperSignalDoc> = await signals.insertOne(doc);

  try {
    const io = getSocketServer((res.socket as any)?.server);
    const room = `toilet:${toiletId}`;
    io.to(room).emit('paper_request', {
      _id: result.insertedId.toHexString(),
      toiletId,
      lat,
      lng,
      message: doc.message,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      acceptedByUserId: null,
    });
    io.to(room).emit('signals_changed', { toiletId });
  } catch {
    // dev에서 소켓 서버 초기화 전이면 무시
  }

  return res.status(201).json({
    ok: true,
    id: result.insertedId.toHexString(),
    expiresAt: expiresAt.toISOString(),
  });
}
