import { connectDB } from "@/util/database";
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';

export default async function handler(요청:NextApiRequest, 응답:NextApiResponse) {
  if (요청.method === 'POST') {
    const { email, password } = 요청.body;

    if (!email || !password) {
      return 응답.status(400).json('이메일과 비밀번호를 입력해주세요.');
    }

    const db = (await connectDB).db('toilet_app');

    // 이미 가입된 이메일 체크
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return 응답.status(409).json('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // MongoDB에 저장
    await db.collection('users').insertOne({
      email,
      password: hashedPassword,
    });

    // 리디렉션
    return 응답.redirect(302, '/signup');
  } else {
    return 응답.status(405).json('POST 요청만 가능합니다.');
  }
}