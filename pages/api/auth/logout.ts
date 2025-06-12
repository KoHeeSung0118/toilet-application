// /pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const expiredCookie = serialize('token', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 로컬 환경에서는 false
    maxAge: 0, // 즉시 만료
  });

  res.setHeader('Set-Cookie', expiredCookie);
  return res.status(200).json({ message: '로그아웃 완료' });
}
