// pages/api/socketio-init.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { attachSocketServer, getSocketServer } from '@/util/socketServer';

type ResWithSocket = NextApiResponse & {
  socket: { server: HTTPServer & { __ioAttached?: boolean } };
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const r = res as ResWithSocket;

  if (!r?.socket?.server) {
    return res.status(500).json({ ok: false, error: 'No HTTP server bound' as any });
  }

  // ✅ 중복 attach 방지 (핫리로드/중복 호출 대비)
  if (!r.socket.server.__ioAttached) {
    attachSocketServer(r.socket.server);
    r.socket.server.__ioAttached = true;
  }

  // 인스턴스 보장(초기화 실패시 throw로 잡히게)
  getSocketServer();

  // 캐시 금지
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
