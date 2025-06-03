// pages/api/toilet/[id].ts
import { connectDB } from '@/util/database';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  const { id, place_name } = req.query;
  const db = (await connectDB).db('toilet_app');

  const toilet = await db.collection('toilets').findOne({ id });

  if (!toilet && place_name) {
    return res.status(200).json({ place_name });
  }

  if (!toilet) return res.status(404).json({ message: '정보 없음' });

  return res.status(200).json(toilet);
}
