import Pusher from 'pusher';

const must = (name: string, v?: string): string => {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

export const pusherServer = new Pusher({
  appId: must('PUSHER_APP_ID', process.env.PUSHER_APP_ID),
  key: must('PUSHER_KEY', process.env.PUSHER_KEY),
  secret: must('PUSHER_SECRET', process.env.PUSHER_SECRET),
  cluster: must('PUSHER_CLUSTER', process.env.PUSHER_CLUSTER), // e.g. 'ap3'
  useTLS: true,
});

export type ToiletEventPayload = Record<string, unknown>;

/** 특정 화장실 채널로 이벤트 전송 + 전역 채널에도 변경 신호 */
export async function emitToiletEvent<T extends ToiletEventPayload>(
  toiletId: string,
  event: string,
  payload: T
): Promise<void> {
  const room = `toilet-${toiletId}`;
  await pusherServer.trigger(room, event, payload);
  // 지도 화면 캐치업(여러 화장실 보고 있을 때)
  await pusherServer.trigger('toilet-global', 'signals_changed', { toiletId });
}
