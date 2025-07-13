// ✅ pages/api/toilet/[id]/comment/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import jwt from 'jsonwebtoken';

interface Review {
  _id: string;
  userId: string;
}
interface ToiletDoc {
  id: string;
  reviews?: Review[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  /* 1. JWT */
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: '로그인 필요' });

  let userId = '';
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string };
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰' });
  }

  /* 2. 파라미터 */
  const { commentId } = req.body;
  const toiletId = req.query.id as string;
  if (!commentId || !toiletId) {
    return res.status(400).json({ message: '필수 항목 누락' });
  }

  /* 3. DB */
  const db = (await connectDB).db('toilet_app');
  const toilets = db.collection<ToiletDoc>('toilets');

  /* 4. 댓글 삭제 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await toilets.updateOne(
    { id: toiletId },
    {
      $pull: {
        reviews: { _id: commentId, userId },
      },
    } as any
  );

  if (result.modifiedCount === 0) {
    return res
      .status(403)
      .json({ message: '댓글 삭제 권한 없음 또는 댓글 없음' });
  }

  return res
    .status(200)
    .json({ success: true, message: '댓글이 삭제되었습니다.' });
}
