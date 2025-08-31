import type { NextApiRequest, NextApiResponse } from 'next';
import { pusherServer } from '@/lib/pusher';

type ApiResp = { ok: true } | { ok: false; error: string };

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<ApiResp>
): Promise<void> {
  try {
    await pusherServer.trigger('toilet-global', 'signals_changed', { toiletId: 'TEST-123' });
    res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
}
