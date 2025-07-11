// /pages/api/toilet/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

interface Review {
  user: string;
  comment: string;
}

interface Toilet {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  keywords: string[];
  reviews: Review[];
  cleanliness: number;
  facility: number;
  convenience: number;
  overallRating: number;
  [key: string]: unknown; // MongoDB 내부 필드(_id 등)를 허용하기 위해 유지
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, place_name: rawPlaceName = '이름 미정' } = req.query;
  const place_name = Array.isArray(rawPlaceName) ? rawPlaceName[0] : rawPlaceName;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  let toilet = await db.collection<Toilet>('toilets').findOne({ id });

  if (!toilet) {
    const newToilet: Toilet = {
      id,
      place_name,
      address_name: '',
      road_address_name: '',
      x: '',
      y: '',
      keywords: [],
      reviews: [],
      cleanliness: 3,
      facility: 3,
      convenience: 3,
      overallRating: 3,
    };

    await db.collection('toilets').insertOne(newToilet);
    toilet = await db.collection<Toilet>('toilets').findOne({ id });
  }

  const parseDecimal = (v: unknown): number | undefined => {
    if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
      return parseFloat((v as { $numberDecimal: string }).$numberDecimal);
    }
    return typeof v === 'number' ? v : undefined;
  };

  if (!toilet) {
    return res.status(500).json({ error: '화장실 정보를 찾을 수 없습니다.' });
  }

  const {
    place_name: name,
    address_name,
    road_address_name,
    x,
    y,
    keywords,
    reviews,
    cleanliness,
    facility,
    convenience,
    overallRating,
  } = toilet;

  return res.status(200).json({
    id,
    place_name: name,
    address_name: address_name ?? '',
    road_address_name: road_address_name ?? '',
    x: x ?? '',
    y: y ?? '',
    keywords: Array.isArray(keywords) ? keywords : [],
    reviews: Array.isArray(reviews) ? reviews : [],
    cleanliness: parseDecimal(cleanliness),
    facility: parseDecimal(facility),
    convenience: parseDecimal(convenience),
    overallRating: parseDecimal(overallRating),
  });
}
