// pages/api/toilet/[id]/comment/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import type { UpdateFilter } from 'mongodb';

interface Review {
  _id: string;      // ← 댓글 id가 문자열로 저장돼 있다면 그대로 사용
  userId: string;
}
interface ToiletDoc {
  id: string;
  reviews?: Review[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  // 1) JWT 검사
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인 필요' });

  let userId = '';
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰' });
  }

  // 2) 파라미터
  const toiletId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const { commentId } = (req.body ?? {}) as { commentId?: string };

  if (!toiletId || !commentId) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }

  // 3) DB
  const client = await connectDB;
  const db = client.db('toilet_app');
  const toilets = db.collection<ToiletDoc>('toilets');

  // 4) 댓글 삭제 (본인 댓글만)
  const pullFilter: UpdateFilter<ToiletDoc> = {
    $pull: { reviews: { _id: commentId, userId } },
  };

  const result = await toilets.updateOne({ id: String(toiletId) }, pullFilter);

  if (result.modifiedCount === 0) {
    return res.status(403).json({ message: '댓글 삭제 권한 없음 또는 댓글 없음' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ success: true, message: '댓글이 삭제되었습니다.' });
}
