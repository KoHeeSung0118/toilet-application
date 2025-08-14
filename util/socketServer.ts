// util/socketServer.ts
import type { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';

// 🔑 HMR/라우트 간 공유를 위해 전역에 보관
declare global {
  // eslint-disable-next-line no-var
  var _io: IOServer | undefined;
}

/** 서버에 Socket.IO를 1회 부착하고 전역에 저장 */
export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (global._io) return global._io;

  const io = new IOServer(httpServer, { path: '/api/socket' });

  io.on('connection', (socket) => {
    console.log('🔌 connected:', socket.id);

    socket.on('join_toilet', (toiletId: string) => {
      const room = `toilet:${toiletId}`;
      socket.join(room);
      console.log('🟢 JOIN', socket.id, '->', room);
    });

    socket.on('leave_toilet', (toiletId: string) => {
      const room = `toilet:${toiletId}`;
      socket.leave(room);
      console.log('🔴 LEAVE', socket.id, '-/->', room);
    });
  });

  global._io = io; // ✅ 전역에 저장
  return io;
}

/** 어디서든 같은 io 인스턴스를 가져오기 */
export function getSocketServer(): IOServer {
  const io = global._io;
  if (!io) throw new Error('Socket server not initialized');
  return io;
}
