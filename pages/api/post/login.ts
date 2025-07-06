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

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
  }

  const JWT_SECRET = process.env.JWT_SECRET!;
  const isRememberChecked = remember === 'on';

  // ✅ expiresIn과 maxAge를 초 단위로 정확히 일치시킴
  const maxAge = isRememberChecked ? 60 * 60 * 24 * 30 : 60 * 60; // 30일 or 1시간

  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: maxAge } // expiresIn에 숫자(초)도 가능
  );

  const cookie = serialize('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 로컬 개발 환경에선 false
    maxAge, // ✅ 쿠키 유효기간도 정확히 맞춤
  });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ message: '로그인 성공' });
}
