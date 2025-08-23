// pages/api/toilet/[id]/keywords.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  // id 파라미터 처리 (string | string[])
  const qp = req.query.id;
  const id = Array.isArray(qp) ? qp[0] : qp;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: '잘못된 화장실 ID입니다.' });
  }

  // keywords 검증 및 정리
  const raw = (req.body as any)?.keywords;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ message: 'keywords는 배열이어야 합니다.' });
  }

  // 문자열만 남기고 trim → 빈값 제거 → 소문자/정규화(원하면 제거) → 중복 제거 → 개수/길이 제한
  const cleaned = [...new Set(
    raw
      .filter((k: any) => typeof k === 'string')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0)
      .map((k: string) => (k.length > 30 ? k.slice(0, 30) : k)) // 키워드 최대 30자
  )].slice(0, 20); // 최대 20개

  const client = await connectDB;
  const db = client.db('toilet_app');
  const toilets = db.collection('toilets');

  const result = await toilets.updateOne(
    { id: String(id) },
    { $set: { keywords: cleaned, updatedAt: new Date() } }
  );

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    success: true,
    updated: result.modifiedCount > 0,
    keywords: cleaned,
  });
}
