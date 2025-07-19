import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

/* ─ Kakao 검색 API 응답 최소 타입 ─ */
interface KakaoDoc {
  id: string;
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  x?: string; // 경도 (문자열)
  y?: string; // 위도 (문자열)
}

interface Review {
  user: string;
  comment: string;
}

/*
 * MongoDB 컬렉션에 저장하는 스키마 타입
 *  - Kakao 원본 좌표는 문자열(x: lng, y: lat)로 보존
 *  - lat / lng 숫자 필드는 응답 단계에서 계산해서 내려줌
 */
interface Toilet {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도 (string)
  y: string; // 위도 (string)
  keywords: string[];
  reviews: Review[];
  cleanliness: number;
  facility: number;
  convenience: number;
  overallRating: number;
  [key: string]: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, place_name: rawPlace = '' } = req.query as { id?: string; place_name?: string | string[] };
  const place_name = Array.isArray(rawPlace) ? rawPlace[0] : rawPlace;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const col = db.collection<Toilet>('toilets');

  /* 1) DB 조회 */
  let toilet = await col.findOne({ id });

  /* 2) 없거나 이름이 ‘이름 미정 …’이면 Kakao 결과로 보정 */
  if (!toilet || toilet.place_name.startsWith('이름 미정')) {
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
        place_name || '화장실',
      )}`,
      {
        headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      },
    );

    if (!kakaoRes.ok) {
      console.error('[Kakao]', await kakaoRes.text());
      return res.status(502).json({ error: 'Kakao API 호출 실패' });
    }

    const { documents } = (await kakaoRes.json()) as { documents: KakaoDoc[] };
    const doc = documents.find((d) => d.id === id);

    const draft: Toilet = {
      id,
      place_name: doc?.place_name || place_name || '이름 미정 화장실',
      address_name: doc?.address_name ?? '',
      road_address_name: doc?.road_address_name ?? '',
      x: doc?.x ?? '',
      y: doc?.y ?? '',
      keywords: toilet?.keywords ?? [],
      reviews: toilet?.reviews ?? [],
      cleanliness: toilet?.cleanliness ?? 3,
      facility: toilet?.facility ?? 3,
      convenience: toilet?.convenience ?? 3,
      overallRating: toilet?.overallRating ?? 3,
    };

    // upsert → 좌표와 이름만 갱신, 나머지는 보존
    await col.updateOne(
      { id },
      {
        $set: {
          place_name: draft.place_name,
          address_name: draft.address_name,
          road_address_name: draft.road_address_name,
          x: draft.x,
          y: draft.y,
        },
        $setOnInsert: {
          keywords: [],
          reviews: [],
          cleanliness: 3,
          facility: 3,
          convenience: 3,
          overallRating: 3,
        },
      },
      { upsert: true },
    );

    toilet = await col.findOne({ id });
  }

  if (!toilet) {
    return res.status(500).json({ error: '화장실 정보를 찾을 수 없습니다.' });
  }

  /* Decimal128 → number 변환 보조 함수 */
  const num = (v: unknown) =>
    typeof v === 'object' && v !== null && '$numberDecimal' in v
      ? parseFloat((v as { $numberDecimal: string }).$numberDecimal)
      : (v as number | undefined);

  /* 최종 응답: lat / lng 숫자 필드 포함 */
  res.status(200).json({
    ...toilet,
    lat: toilet.y ? parseFloat(toilet.y) : undefined, // 위도
    lng: toilet.x ? parseFloat(toilet.x) : undefined, // 경도
    cleanliness: num(toilet.cleanliness),
    facility: num(toilet.facility),
    convenience: num(toilet.convenience),
    overallRating: num(toilet.overallRating),
  });
}
