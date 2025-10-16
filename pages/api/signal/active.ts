import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { WithId } from 'mongodb';
import { getUserFromTokenInAPI } from '@/lib/getUserFromTokenInAPI';

/**
 * 클라이언트로 내려보낼 아이템(JSON 직렬화된 형태)
 * - 날짜는 string(ISO)로, _id도 string으로 변환해서 보냄
 */
type Item = {
  _id: string;
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId: string | null;
  createdAt: string;
  expiresAt: string;
};

/** API 응답의 최상위 형태 */
type ApiResp = { ok: true; items: Item[] };

/**
 * DB에 저장된 문서 타입(서버 내부에서만 사용)
 * - 여기서는 _id를 명시적으로 넣지 않음 (Mongo가 WithId<T>로 합쳐줌)
 * - 날짜 타입은 Date (DB 원본)
 */
type DbDoc = {
  toiletId: string;
  lat: number;
  lng: number;
  message?: string;
  userId: string;
  acceptedByUserId?: string | null;
  canceledAt?: Date;
  createdAt: Date;
  expiresAt: Date;
};

/**
 * /api/signal/active
 * - 여러 화장실 ID(toiletIds)를 쉼표로 받아서, 활성(미만료/미취소) 신호들을 리스트로 반환
 * - 로그인 여부에 따라 보여줄 항목 가시성(visibility)을 다르게 적용
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  // 1) 메서드 가드: GET만 허용
  if (req.method !== 'GET') return res.status(405).end();

  // 2) 쿠키/헤더의 토큰에서 사용자 ID 추출 (없을 수도 있음)
  const uid = getUserFromTokenInAPI(req);

  // 3) 쿼리 파싱: ?toiletIds=id1,id2,...
  const qp = req.query.toiletIds;
  //    - 배열로 들어오든 문자열로 들어오든 일단 쉼표 연결된 문자열로 통일
  const raw = Array.isArray(qp) ? qp.join(',') : (qp ?? '');
  //    - 쉼표 분리 → 트림 → 빈 값 제거 → 중복 제거 → 최대 100개 제한
  const ids = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 100);

  // 4) 유효한 ID가 없으면 빈 리스트 즉시 반환
  if (!ids.length) return res.status(200).json({ ok: true, items: [] });

  // 5) DB 핸들 준비
  const now = new Date();
  const client = await connectDB;
  const db = client.db(process.env.MONGODB_DB ?? 'toilet_app');
  const signals = db.collection<DbDoc>('signals');

  /**
   * 6) 가시성(visibility) 조건
   * - 로그인(o): 미수락(null/미존재) + 내가 만든 요청(userId=uid) + 내가 수락한 요청(acceptedByUserId=uid)
   * - 로그인(x): 미수락(null/미존재)만
   *   => $or 배열로 구성하여 find에 주입
   */
  const visibilityOr = uid
    ? [
        { acceptedByUserId: null },
        { acceptedByUserId: { $exists: false } },
        { userId: uid },
        { acceptedByUserId: uid },
      ]
    : [
        { acceptedByUserId: null },
        { acceptedByUserId: { $exists: false } },
      ];

  /**
   * 7) 쿼리 실행
   * - toiletId ∈ ids
   * - 취소되지 않았고(canceledAt 미존재)
   * - 아직 만료되지 않았고(expiresAt > now)
   * - 위의 가시성 조건 중 하나 ($or)
   * - projection: 필요한 필드만 선택
   * - createdAt 내림차순 정렬
   */
  const docs: WithId<DbDoc>[] = await signals
    .find(
      {
        toiletId: { $in: ids },
        canceledAt: { $exists: false },
        expiresAt: { $gt: now },
        $or: visibilityOr,
      },
      {
        projection: {
          _id: 1, // 명시적으로 포함
          toiletId: 1,
          lat: 1,
          lng: 1,
          message: 1,
          userId: 1,
          acceptedByUserId: 1,
          createdAt: 1,
          expiresAt: 1,
        },
      }
    )
    .sort({ createdAt: -1 })
    .toArray();

  /**
   * 8) DB 문서 -> API 응답 형태로 직렬화
   * - _id(ObjectId) → string(hex)
   * - Date → string(ISO)
   * - acceptedByUserId 미정의(undefined)면 null로 통일
   */
  const items: Item[] = docs.map(d => ({
    _id: d._id.toHexString(), // ObjectId → 문자열
    toiletId: d.toiletId,
    lat: d.lat,
    lng: d.lng,
    message: d.message,
    userId: d.userId,
    acceptedByUserId: d.acceptedByUserId ?? null,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
  }));

  // 9) 최종 응답
  return res.status(200).json({ ok: true, items });
}
