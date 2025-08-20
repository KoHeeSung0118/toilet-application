// lib/getUserFromTokenInAPI.ts
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export function getUserFromTokenInAPI(req: { headers: { cookie?: string } }): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const cookies = parse(raw);
  const token = cookies.token;
  if (!token) return null;

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    return userId;
  } catch {
    return null;
  }
}
