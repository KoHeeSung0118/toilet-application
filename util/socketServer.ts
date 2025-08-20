// util/socketServer.ts
import type { Server as HTTPServer } from 'http';
import { Server as IOServer, type ServerOptions } from 'socket.io';

let ioInstance: IOServer | null = null;

export function initSocketServer(server: HTTPServer): IOServer {
  if (ioInstance) return ioInstance;

  const opts: Partial<ServerOptions> = {
    path: '/api/socket',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  };

  ioInstance = new IOServer(server, opts);

  ioInstance.on('connection', (socket) => {
    // join/leave 방
    socket.on('join_toilet', (toiletId: string) => {
      if (typeof toiletId === 'string' && toiletId.length > 0) {
        socket.join(`toilet:${toiletId}`);
        // console.log(`🟢 JOIN ${socket.id} -> toilet:${toiletId}`);
      }
    });
    socket.on('leave_toilet', (toiletId: string) => {
      if (typeof toiletId === 'string' && toiletId.length > 0) {
        socket.leave(`toilet:${toiletId}`);
        // console.log(`🔴 LEAVE ${socket.id} -/-> toilet:${toiletId}`);
      }
    });
  });

  return ioInstance;
}

export function getSocketServer(): IOServer {
  if (!ioInstance) {
    throw new Error('Socket server not initialized');
  }
  return ioInstance;
}
