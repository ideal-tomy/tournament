import { supabase } from './supabase';
import type { EventRow, EventStatus } from '../types';

export type ActiveEvent = Pick<EventRow, 'id' | 'title' | 'status'>;

export function isRehearsalEventTitle(title: string): boolean {
  return title.startsWith('[REHEARSAL]');
}

/** @deprecated use isRehearsalEventTitle */
export function isRehearsalEventName(name: string): boolean {
  return isRehearsalEventTitle(name);
}

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
    .select('id, title, status')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  return data as ActiveEvent | null;
}

async function fetchLatestRehearsalEvent(includeFinished = false): Promise<ActiveEvent | null> {
  let query = supabase
    .from('events')
    .select('id, title, status')
    .ilike('title', '[REHEARSAL]%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!includeFinished) {
    query = query.neq('status', 'finished');
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data as ActiveEvent | null;
}

/** 再利用用 — 終了済みリハーサルも含む最新 */
export async function getLatestRehearsalEvent(): Promise<ActiveEvent | null> {
  return fetchLatestRehearsalEvent(true);
}

async function fetchLatestActiveEvent(): Promise<ActiveEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, status')
    .neq('status', 'finished')
    .neq('status', 'archived')
    .not('title', 'ilike', '[REHEARSAL]%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ActiveEvent | null;
}

function formatSupabaseError(error: unknown, fallback: string): Error {
  if (error && typeof error === 'object' && 'message' in error) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.message, e.code && `code=${e.code}`, e.details, e.hint].filter(Boolean);
    return new Error(parts.join(' | ') || fallback);
  }
  return new Error(fallback);
}

async function createEvent(): Promise<ActiveEvent> {
  const title = `ダーツ大会 ${todayLabel()}`;
  const { data, error } = await supabase
    .from('events')
    .insert({ title, status: 'entry' satisfies EventStatus })
    .select('id, title, status')
    .single();

  if (error || !data) {
    throw formatSupabaseError(error, 'イベント作成に失敗しました');
  }
  return data as ActiveEvent;
}

/**
 * アクティブイベント取得。
 * URL の eventId を最優先（見つからなければエラー）。
 * 無指定時: ?rehearsal=1 → 最新リハーサル → 最新本番 → 新規作成。
 */
export async function getOrCreateActiveEvent(
  urlEventId?: string | null,
): Promise<ActiveEvent> {
  const fromUrl = urlEventId ?? getEventIdFromUrl();
  if (fromUrl) {
    const existing = await fetchEventById(fromUrl);
    if (existing) return existing;
    throw new Error(
      `イベントが見つかりません（ID: ${fromUrl.slice(0, 8)}…）。URL の eventId を確認してください。`,
    );
  }

  const rehearsalMode = new URLSearchParams(window.location.search).get('rehearsal');
  if (rehearsalMode === '1' || rehearsalMode === 'latest') {
    const latestRehearsal = await fetchLatestRehearsalEvent();
    if (latestRehearsal) return latestRehearsal;
  }

  const latest = await fetchLatestActiveEvent();
  if (latest) return latest;

  return createEvent();
}

/** リハーサル専用イベント（本番の getOrCreateActiveEvent からは除外） */
export async function createRehearsalEvent(): Promise<ActiveEvent> {
  const ts = new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const title = `[REHEARSAL] ${todayLabel()} ${ts}`;
  const { data, error } = await supabase
    .from('events')
    .insert({ title, status: 'entry' satisfies EventStatus })
    .select('id, title, status')
    .single();

  if (error || !data) {
    throw formatSupabaseError(error, 'リハーサルイベント作成に失敗しました');
  }
  return data as ActiveEvent;
}
