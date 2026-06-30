import { supabase } from './supabase';
import type { EventRow } from '../types';

export type ActiveEvent = Pick<EventRow, 'id' | 'name' | 'status'>;

function todayLabel(): string {
  return new Date().toLocaleDateString('ja-JP');
}

/** URL クエリ ?eventId=xxx があればそれを取得 */
export function getEventIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('eventId');
}

/** eventId を URL に反映（リロード復元・Admin/Display 共有用） */
export function syncEventIdToUrl(eventId: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('eventId') === eventId) return;
  url.searchParams.set('eventId', eventId);
  window.history.replaceState({}, '', url.toString());
}

async function fetchEventById(eventId: string): Promise<ActiveEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchLatestActiveEvent(): Promise<ActiveEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, status')
    .neq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createEvent(): Promise<ActiveEvent> {
  const name = `ダーツ大会 ${todayLabel()}`;
  const { data, error } = await supabase
    .from('events')
    .insert({ name, status: 'setup' })
    .select('id, name, status')
    .single();

  if (error || !data) throw error ?? new Error('イベント作成に失敗しました');
  return data;
}

/**
 * アクティブイベント取得。なければ status='setup' で新規作成。
 * URL の eventId を優先し、無ければ未終了の最新 1 件 → 新規作成。
 */
export async function getOrCreateActiveEvent(
  urlEventId?: string | null,
): Promise<ActiveEvent> {
  const fromUrl = urlEventId ?? getEventIdFromUrl();
  if (fromUrl) {
    const existing = await fetchEventById(fromUrl);
    if (existing) return existing;
  }

  const latest = await fetchLatestActiveEvent();
  if (latest) return latest;

  return createEvent();
}
