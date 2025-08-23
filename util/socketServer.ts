// util/socketServer.ts
import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';

let io: IOServer | null = null;

export function initSocketServer(server: HTTPServer): IOServer {
  if (io) return io;

  io = new IOServer(server, {
    path: '/api/socket',
    cors: { origin: '*' },
  });

  io.on('connection', (socket: Socket) => {
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

  return io;
}

export function getSocketServer(): IOServer {
  if (!io) throw new Error('Socket server not initialized');
  return io;
}

// ✅ 변경 사항이 생기면 이 헬퍼만 호출
export function emitSignalsChanged(toiletId: string | number, extra?: Record<string, unknown>) {
  if (!io) return;
  io.to(`toilet:${toiletId}`).emit('signals_changed', { toiletId: String(toiletId), ...(extra ?? {}) });
}
