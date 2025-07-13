// ✅ lib/getUserIdFromToken.ts
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

/**
 * JWT 쿠키에서 userId 추출
 */
export async function getUserIdFromToken(): Promise<string | null> {
  // Next 15+: cookies() → Promise
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  try {
    const { userId } = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string };
    return userId;
  } catch {
    return null;
  }
}
