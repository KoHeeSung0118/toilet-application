// pages/api/post/signup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import bcrypt from 'bcrypt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'POST 요청만 가능합니다.' });
  }

  const { email, password, passwordConfirm } = req.body as {
    email?: string;
    password?: string;
    passwordConfirm?: string;
  };

  // 입력값 검증
  if (!email || !password || !passwordConfirm) {
    return res.status(400).json({ ok: false, message: '모든 필드를 입력해주세요.' });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ ok: false, message: '비밀번호가 일치하지 않습니다.' });
  }
  // 간단한 이메일/비번 체크 (원하면 규칙 강화 가능)
  const normEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
    return res.status(400).json({ ok: false, message: '이메일 형식이 올바르지 않습니다.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ ok: false, message: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const client = await connectDB;
  const db = client.db('toilet_app');
  const users = db.collection<{ email: string; password: string; createdAt: Date }>('users');

  // 중복 이메일 확인 (항상 소문자로 저장하므로 단순 비교 가능)
  const existing = await users.findOne({ email: normEmail }, { projection: { _id: 1 } });
  if (existing) {
    return res.status(409).json({ ok: false, message: '이미 존재하는 이메일입니다.' });
  }

  // 비밀번호 해시 후 저장
  const hashedPassword = await bcrypt.hash(String(password), 12);
  await users.insertOne({
    email: normEmail,
    password: hashedPassword,
    createdAt: new Date(),
  });

  return res.status(201).json({ ok: true, message: '회원가입 성공' });
}
