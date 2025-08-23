// pages/api/signal/request-paper.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import type { InsertOneResult } from 'mongodb';
import { emitSignalsChanged, getSocketServer } from '@/util/socketServer';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

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
  // _id는 Mongo가 붙여줌
  toiletId: string;
  lat: number;
  lng: number;
  message?: string | null;
  userId: string;
  acceptedByUserId?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResp>
) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = getUserFromTokenInAPI(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { toiletId, lat, lng, message } = req.body as Body;

  // ✅ 기본 유효성
  if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // ✅ 좌표 범위 방어
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  // ✅ 메시지 정리(optional)
  const cleanMsg =
    typeof message === 'string'
      ? message.trim().slice(0, 500) // 길이 제한(필요 시 조정)
      : undefined;

  const now = new Date();
  const tenMin = 10 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + tenMin);

  const client = await connectDB;
  const db = client.db('toilet');
  const signals = db.collection<PaperSignalDoc>('signals');

  // 동일 유저 활성 요청이 이미 있으면 막기
  const existing = await signals.findOne({
    userId,
    expiresAt: { $gt: now },
  });
  if (existing) return res.status(409).json({ error: 'Active request exists' });

  const doc: PaperSignalDoc = {
    toiletId,
    lat,
    lng,
    message: cleanMsg ?? undefined,
    userId,
    acceptedByUserId: null,
    createdAt: now,
    expiresAt,
  };

  const result: InsertOneResult<PaperSignalDoc> = await signals.insertOne(doc);

  // broadcast
  try {
    getSocketServer(); // 인스턴스 보장
    emitSignalsChanged(toiletId, 'paper_request', {
      _id: result.insertedId.toHexString(),
      toiletId,
      lat,
      lng,
      message: cleanMsg ?? null,
      userId,
      acceptedByUserId: null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    /* no-op in dev */
  }

  return res.status(201).json({
    ok: true,
    id: result.insertedId.toHexString(),
    expiresAt: expiresAt.toISOString(),
  });
}
