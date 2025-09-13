import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import type { InsertOneResult } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';
import { emitToiletEvent } from '@/lib/pusher';

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
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const userId = getUserFromTokenInAPI(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { toiletId, lat, lng, message } = req.body as Body;

  // 기본 유효성
  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  // 메시지 정리
  const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 120) : undefined;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10분

  const client = await connectDB;
  const db = client.db(process.env.MONGODB_DB ?? 'toilet_app');
  const signals = db.collection<PaperSignalDoc>('signals');

  // 단일 활성 요청 제한
  const existing = await signals.findOne({
    userId,
    canceledAt: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (existing) {
    res.status(409).json({ error: 'already_active' });
    return;
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

  // 실시간 이벤트 발행
  await emitToiletEvent(toiletId, 'paper_request', {
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

  res.status(201).json({
    ok: true,
    id: result.insertedId.toHexString(),
    expiresAt: expiresAt.toISOString(),
  });
}
