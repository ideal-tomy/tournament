import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { RealtimeEvent } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

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

export interface SubscribeOptions {
  onEvent: (payload: RealtimeEvent) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onReconnect?: () => void;
}

const RECONNECT_DELAY_MS = 2000;

/** 購読（表示端末）— 切断時に自動再接続 */
export function subscribeWithReconnect(
  eventId: string,
  options: SubscribeOptions,
): () => void {
  let disposed = false;
  let wasConnected = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let ch: RealtimeChannel | null = null;

  const clearTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = () => {
    if (disposed) return;
    options.onStatus?.('connecting');

    if (ch) {
      supabase.removeChannel(ch);
      ch = null;
    }

    ch = eventChannel(eventId);
    ch.on('broadcast', { event: '*' }, ({ payload }) => {
      options.onEvent(payload as RealtimeEvent);
    });
    ch.on('system', {}, (payload) => {
      const status = (payload as { status?: string }).status;
      if (status === 'SUBSCRIBED') {
        if (wasConnected) {
          options.onReconnect?.();
        }
        wasConnected = true;
        options.onStatus?.('connected');
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        options.onStatus?.(status === 'CHANNEL_ERROR' ? 'error' : 'disconnected');
        scheduleReconnect();
      }
    });
    ch.subscribe();
  };

  connect();

  return () => {
    disposed = true;
    clearTimer();
    if (ch) supabase.removeChannel(ch);
  };
}

/** 購読（後方互換） */
export function subscribe(
  eventId: string,
  handler: (e: RealtimeEvent) => void,
): () => void {
  return subscribeWithReconnect(eventId, { onEvent: handler });
}
