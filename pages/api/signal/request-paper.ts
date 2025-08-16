// pages/api/signal/request-paper.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { WithId } from 'mongodb';
import { connectDB } from '@/util/database';
import { getSocketServer } from '@/util/socketServer';

/** 요청 바디(이 파일 한정) */
type PaperRequestBody = {
  toiletId: string;
  lat: number;
  lng: number;
  userId?: string | null;
  message?: string | null;
};

/** DB 문서 타입 */
type SignalType = 'PAPER_REQUEST';
interface SignalDoc {
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;   // 로그인 사용자
  sourceIp: string;        // 비로그인 사용자 제어용
  type: SignalType;
  message?: string;        // ✅ 사용자 메모(옵션)
  createdAt: Date;
  expiresAt: Date;
}

/** 소켓 페이로드 타입 */
interface PaperSignalPayload {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  userId: string | null;
  type: 'PAPER_REQUEST';
  message?: string;     // ✅ 함께 방송
  createdAt: string;
  expiresAt: string;
}

type SuccessRes = { ok: true; id: string; expiresAt: string };
type ErrorRes = { error: string };

/** Vercel/프록시 환경 포함한 IP 추출 */
function getClientIp(req: NextApiRequest): string {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) return xfwd.split(',')[0]!.trim();
  if (Array.isArray(xfwd) && xfwd.length > 0) return xfwd[0]!.trim();
  const addr = req.socket.remoteAddress ?? '';
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr;
}

/** 인덱스 보장(콜드스타트 1회 수준) */
let indexesEnsured = false;
async function ensureIndexes() {
  if (indexesEnsured) return;
  const db = (await connectDB).db('toilet');
  const col = db.collection<SignalDoc>('signals');

  await col.createIndexes([
    { key: { userId: 1, expiresAt: -1 }, name: 'by_user_active' },
    { key: { sourceIp: 1, expiresAt: -1 }, name: 'by_ip_active' },
    { key: { userId: 1, toiletId: 1, createdAt: -1 }, name: 'by_user_toilet_recent' },
    { key: { toiletId: 1, createdAt: -1 }, name: 'by_toilet_recent' },
    { key: { expiresAt: 1 }, name: 'by_expire' },
  ]);

  indexesEnsured = true;
}

/** 간단 sanitize: 문자열만 허용, 길이 제한(최대 120자), 줄바꿈/태그 제거 */
function sanitizeMessage(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const noTags = trimmed.replace(/<[^>]*>/g, '');
  const oneLine = noTags.replace(/[\r\n]+/g, ' ');
  return oneLine.slice(0, 120);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessRes | ErrorRes>
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { toiletId, lat, lng, userId, message } = req.body as PaperRequestBody;

  // 페이로드 검증
  if (
    !toiletId ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2분
  const ip = getClientIp(req);
  const safeMessage = sanitizeMessage(message);

  const db = (await connectDB).db('toilet');
  const signals = db.collection<SignalDoc>('signals');

  await ensureIndexes();

  // ✅ "사용자 1명 = 활성 요청 1개" 강제 (로그인/비로그인)
  if (userId && userId.length > 0) {
    const active = await signals.findOne({
      userId,
      expiresAt: { $gt: now },
      type: 'PAPER_REQUEST',
    });
    if (active) {
      return res.status(429).json({ error: '이미 전송된 요청이 처리 중이에요. 잠시만 기다려주세요.' });
    }
  } else {
    const activeByIp = await signals.findOne({
      sourceIp: ip,
      expiresAt: { $gt: now },
      type: 'PAPER_REQUEST',
    });
    if (activeByIp) {
      return res.status(429).json({ error: '이미 전송된 요청이 처리 중이에요. 잠시만 기다려주세요.' });
    }
  }

  // 동일 사용자+화장실 60초 제한(유지)
  if (userId && userId.length > 0) {
    const recent = await signals.findOne({
      userId,
      toiletId,
      type: 'PAPER_REQUEST',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });
    if (recent) {
      return res.status(429).json({ error: '같은 화장실에 너무 빠르게 요청하고 있어요. 잠시만 기다려주세요.' });
    }
  }

  // 문서 저장
  const doc: SignalDoc = {
    toiletId,
    lat,
    lng,
    userId: userId ?? null,
    sourceIp: ip,
    type: 'PAPER_REQUEST',
    message: safeMessage,     // ✅ 저장
    createdAt: now,
    expiresAt,
  };

  const result = await signals.insertOne(doc);
  const insertedId = result.insertedId.toHexString();

  // 웹소켓 브로드캐스트
  try {
    const io = getSocketServer();
    const payload: PaperSignalPayload = {
      _id: insertedId,
      toiletId: doc.toiletId,
      lat: doc.lat,
      lng: doc.lng,
      userId: doc.userId,
      type: doc.type,
      message: doc.message,   // ✅ 방송
      createdAt: doc.createdAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
    };
    io.to(`toilet:${toiletId}`).emit('paper_request', payload);
  } catch {
    // 소켓 서버 미초기화 시 무시
  }

  return res.status(201).json({
    ok: true,
    id: insertedId,
    expiresAt: expiresAt.toISOString(),
  });
}
