import { connectDB } from '@/util/database';
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, message: 'POST 요청만 가능합니다.' });

  const { email, password, passwordConfirm } = req.body;

  /* 입력값 검증 */
  if (!email || !password || !passwordConfirm)
    return res.status(400).json({ ok: false, message: '모든 필드를 입력해주세요.' });

  if (password !== passwordConfirm)
    return res.status(400).json({ ok: false, message: '비밀번호가 일치하지 않습니다.' });

  const db = (await connectDB).db('toilet_app');

  /* 중복 이메일 확인 */
  const existing = await db.collection('users').findOne({ email });
  if (existing)
    return res.status(409).json({ ok: false, message: '이미 존재하는 이메일입니다.' });

  /* 비밀번호 암호화 후 저장 */
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.collection('users').insertOne({ email, password: hashedPassword });

  /* 성공 ⇒ 프론트가 알아서 이동하게만 신호 */
  return res.status(201).json({ ok: true, message: '회원가입 성공' });
}
