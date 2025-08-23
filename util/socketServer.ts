// util/socketServer.ts
import { Server as IOServer, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';

declare global {
  // 전역에 io 싱글톤 보관
  // eslint-disable-next-line no-var
  var __io__: IOServer | undefined;
}

/** 전역 IO 인스턴스 얻기 (없으면 임시 인스턴스 생성) */
export function getSocketServer(): IOServer {
  if (!globalThis.__io__) {
    // HTTP 서버에 붙이지 않은 임시 인스턴스 (init 라우트에서 실제 attach)
    globalThis.__io__ = new IOServer({
      path: '/api/socket',
      addTrailingSlash: false,
      serveClient: false,
    });
  }
  return globalThis.__io__;
}

/** Next의 HTTP 서버에 Socket.IO를 1회만 붙임 */
export function attachSocketServer(httpServer: HTTPServer): IOServer {
  if (globalThis.__io__ && (globalThis.__io__ as IOServer).engine) {
    // 이미 attach 된 경우
    return globalThis.__io__!;
  }
  const io = new IOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join_toilet', (toiletId: string) => {
      socket.join(`toilet:${toiletId}`);
    });
    socket.on('leave_toilet', (toiletId: string) => {
      socket.leave(`toilet:${toiletId}`);
    });
  });

  globalThis.__io__ = io;
  return io;
}

/** 해당 화장실 방과 ALL 방에 신호 변경 이벤트 브로드캐스트 */
export function emitSignalsChanged(
  toiletId: string,
  event:
    | 'paper_request'
    | 'paper_accepted'
    | 'paper_accept_canceled'
    | 'paper_canceled',
  payload: Record<string, unknown>
): void {
  const io = getSocketServer();
  const room = `toilet:${toiletId}`;

  io.to(room).emit(event, payload);
  io.to(room).emit('signals_changed', { toiletId });

  // 개발/맵 화면 캐치업용 ALL
  io.to('toilet:ALL').emit(event, payload);
  io.to('toilet:ALL').emit('signals_changed', { toiletId });
}
