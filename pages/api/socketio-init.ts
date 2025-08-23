// pages/api/socketio-init.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import { attachSocketServer, getSocketServer } from '@/util/socketServer';

type ResWithSocket = NextApiResponse & {
  socket: {
    server: HTTPServer;
  };
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const r = res as ResWithSocket;
  // HTTP 서버에 실제로 1회만 attach
  attachSocketServer(r.socket.server);
  // 인스턴스 보장
  getSocketServer();
  return res.status(200).json({ ok: true });
}
