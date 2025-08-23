// pages/api/socketio-init.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { Server as IOServer } from 'socket.io';
import { getSocketServer } from '@/util/socketServer';

type ResWithSocket = NextApiResponse & {
  socket: NetSocket & { server: HTTPServer & { io?: IOServer } };
};

export default function handler(req: NextApiRequest, res: ResWithSocket) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const server = res.socket?.server;
  if (!server) return res.status(500).json({ error: 'No HTTP server bound' });

  // ✅ 최초 요청 시 socket.io 초기화 + 재사용
  getSocketServer(server);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
