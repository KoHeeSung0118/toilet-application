import Pusher from 'pusher-js';

let instance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!instance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY as string;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string;
    instance = new Pusher(key, { cluster, forceTLS: true });
  }
  return instance;
}
