// /pages/api/toilet/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, place_name = '이름 미정' } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const db = (await connectDB).db('toilet_app');
  let toilet = await db.collection('toilets').findOne({ id });

  // 📌 없으면 새로 등록
  if (!toilet) {
    toilet = {
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

    await db.collection('toilets').insertOne(toilet);
  }

  const parseDecimal = (v: any): number | undefined => {
    if (typeof v === 'object' && v?.$numberDecimal) {
      return parseFloat(v.$numberDecimal);
    }
    return typeof v === 'number' ? v : undefined;
  };

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
