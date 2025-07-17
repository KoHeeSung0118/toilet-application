import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/util/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, message: 'POST 요청만 허용됩니다.' });

  const { email, password, remember = false } = req.body;
  const db   = (await connectDB).db('toilet_app');
  const user = await db.collection('users').findOne({ email });

  if (!user)
    return res.status(401).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });

  const pwMatch = await bcrypt.compare(password, user.password);
  if (!pwMatch)
    return res.status(401).json({ ok: false, message: '비밀번호가 틀렸습니다.' });

  /* remember (boolean) 처리 */
  const keep30Days = remember === true || remember === 'on';
  const maxAgeSec  = keep30Days ? 60 * 60 * 24 * 30 : 60 * 60; // 30일 or 1시간
  const expires    = new Date(Date.now() + maxAgeSec * 1000);

  /* JWT 발급 */
  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: maxAgeSec },
  );

  /* 쿠키 설정 */
  const cookie = serialize('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // 🌐 프로덕션에서만 secure
    maxAge: maxAgeSec,
    expires,
  });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true, message: '로그인 성공' });
}
