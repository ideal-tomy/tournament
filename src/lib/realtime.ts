import { supabase } from './supabase';
import type { RealtimeEvent } from '../types';

export function eventChannel(eventId: string) {
  return supabase.channel(`event:${eventId}`, {
    config: { broadcast: { self: false } },
  });
}

/** 送信（操作端末） */
export async function broadcast(eventId: string, payload: RealtimeEvent) {
  const ch = eventChannel(eventId);
  await ch.subscribe();
  await ch.send({ type: 'broadcast', event: payload.type, payload });
  supabase.removeChannel(ch);
}

/** 購読（表示端末） */
export function subscribe(
  eventId: string,
  handler: (e: RealtimeEvent) => void,
): () => void {
  const ch = eventChannel(eventId);
  ch.on('broadcast', { event: '*' }, ({ payload }) => {
    handler(payload as RealtimeEvent);
  });
  ch.subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
