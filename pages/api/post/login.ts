import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
    }

    const { email, password } = req.body;

    const db = (await connectDB).db('toilet_app');
    const user = await db.collection('users').findOne({ email });

    if (!user) {
        return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const ismatch = await bcrypt.compare(password, user.password);
    if (!ismatch) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }
// 1. JWT 토큰 발급
const JWT_SECRET = process.env.JWT_SECRET!;
const token = jwt.sign(
  { userId: user._id.toString(), email: user.email },
  JWT_SECRET,
  { expiresIn: '7d' } // 유효기간: 7일
);

// 2. 토큰을 쿠키에 저장
res.setHeader(
  'Set-Cookie',
  `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
);

    return res.redirect(302, '/');
}