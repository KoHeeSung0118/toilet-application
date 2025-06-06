// /pages/api/toilet/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  const toilet = await db.collection('toilets').findOne({ id });

  if (!toilet) {
    return res.status(404).json({ error: '해당 화장실을 찾을 수 없습니다.' });
  }

  // Decimal128 같은 경우 parseFloat를 사용해서 숫자로 바꿔준다
  const parseDecimal = (v: any) => {
    if (typeof v === 'object' && v !== null) {
      // MongoDB Decimal128 형태일 때
      if (v.$numberDecimal) return parseFloat(v.$numberDecimal);
    }
    return v;
  };

  // 응답할 필드를 명확히 지정
  return res.status(200).json({
    id: toilet.id,
    place_name: toilet.place_name,
    address_name: toilet.address_name ?? '',
    road_address_name: toilet.road_address_name ?? '',
    x: toilet.x ?? '',
    y: toilet.y ?? '',
    keywords: Array.isArray(toilet.keywords) ? toilet.keywords : [],
    reviews: Array.isArray(toilet.reviews) ? toilet.reviews : [],
    cleanliness: parseDecimal(toilet.cleanliness),
    facility: parseDecimal(toilet.facility),
    convenience: parseDecimal(toilet.convenience),
    overallRating: parseDecimal(toilet.overallRating),
  });
}
