import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const { email, password, remember } = req.body;

  const db = (await connectDB).db('toilet_app');
  const user = await db.collection('users').findOne({ email });

  if (!user) {
    return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
  }

  const ismatch = await bcrypt.compare(password, user.password);
  if (!ismatch) {
    return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
  }
  const JWT_SECRET = process.env.JWT_SECRET!;
  const isRememberChecked = remember === 'on';
  const maxAge = isRememberChecked ? 60 * 60 * 24 * 30 : undefined;

  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: isRememberChecked ? '30d' : '1h' }
  );

const cookie = serialize('token', token, {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // 로컬 개발환경에서는 반드시 false
  maxAge: 60 * 60 * 24 * 7,
});
res.setHeader('Set-Cookie', cookie);


  // ❗ redirect 대신 JSON 응답 (프론트에서 router.push 사용)
  return res.status(200).json({ message: '로그인 성공' });
}
