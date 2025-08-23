// pages/api/post/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { WithId } from 'mongodb';

type UserDoc = { email: string; password: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'POST 요청만 허용됩니다.' });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({ ok: false, message: '서버 설정 오류(JWT_SECRET 없음)' });
  }

  const { email, password, remember } = req.body as {
    email?: string;
    password?: string;
    remember?: boolean | string;
  };
  if (!email || !password) {
    return res.status(400).json({ ok: false, message: '이메일과 비밀번호가 필요합니다.' });
  }

  const normEmail = String(email).trim().toLowerCase();

  const client = await connectDB;
  const db = client.db('toilet_app');
  const users = db.collection<UserDoc>('users');

  // 결과 타입: WithId<UserDoc> | null  → _id가 ObjectId로 확정됨
  const user: WithId<UserDoc> | null = await users.findOne(
    { email: normEmail },
    { projection: { email: 1, password: 1 } }
  );

  if (!user) {
    return res.status(401).json({ ok: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const pwMatch = await bcrypt.compare(String(password), user.password);
  if (!pwMatch) {
    return res.status(401).json({ ok: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const keep30Days = remember === true || remember === 'on' || remember === 'true';
  const maxAgeSec = keep30Days ? 60 * 60 * 24 * 30 : 60 * 60;
  const expires = new Date(Date.now() + maxAgeSec * 1000);

  // ✅ _id는 ObjectId → toHexString() 안전
  const userId = user._id.toHexString();

  const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: maxAgeSec });

  const cookie = serialize('token', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSec,
    expires,
  });

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true, message: '로그인 성공' });
}
