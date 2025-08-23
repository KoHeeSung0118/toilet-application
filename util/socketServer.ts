// util/socketServer.ts
import type { Server as HTTPServer } from 'http';
import type { Server as IOServer, Socket } from 'socket.io';
import { Server } from 'socket.io';

type SocketIOWithRooms = IOServer & {
  __inited?: boolean;
};

let io: SocketIOWithRooms | null = null;

export function getSocketServer(httpServer?: HTTPServer): SocketIOWithRooms {
  if (io) return io;

  if (!httpServer) throw new Error('HTTP server required to init socket.io');

  io = new Server(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  }) as SocketIOWithRooms;

  if (!io.__inited) {
    io.__inited = true;

    io.on('connection', (socket: Socket) => {
      // join specific toilet room (e.g., "1485506511"), will be mapped to "toilet:ID"
      socket.on('join_toilet', (toiletId: string) => {
        const room = `toilet:${toiletId}`;
        socket.join(room);
      });

      socket.on('leave_toilet', (toiletId: string) => {
        const room = `toilet:${toiletId}`;
        socket.leave(room);
      });
    });
  }

  return io;
}
