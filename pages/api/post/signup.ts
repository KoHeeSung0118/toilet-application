import { connectDB } from "@/util/database";
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // console.log('요청 메서드:', req.method); // ✅ 실제 어떤 요청인지 확인
  if (req.method === 'POST') {
    const { email, password, passwordConfirm } = req.body;

    // 입력값 유효성 검사
    if (!email || !password || !passwordConfirm) {
      return res.status(400).json('모든 필드를 입력해주세요.');
    }

    // 비밀번호 확인
    if (password !== passwordConfirm) {
      return res.status(400).json('비밀번호가 일치하지 않습니다.');
    }

    const db = (await connectDB).db('toilet_app');

    // 이미 가입된 이메일 체크
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(409).json('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // DB에 저장
    await db.collection('users').insertOne({
      email,
      password: hashedPassword,
    });

    // 성공 시 로그인 페이지로 이동
    return res.redirect(302, '/login');
  } else {
    return res.status(405).json('POST 요청만 가능합니다.');
  }
}
