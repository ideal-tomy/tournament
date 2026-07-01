import { fetchBracketSnapshot } from '../bracket/bracketApi';
import { isRehearsalEventName } from '../../lib/event';
import { supabase } from '../../lib/supabase';
import {
  createFreshRehearsal,
  reuseRehearsal,
  resetRehearsalMatches,
  type RehearsalProgress,
  type RehearsalResult,
} from '../rehearsal/rehearsalActions';
import { listParticipants } from '../registration/registrationApi';

async function loadRehearsalEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, status')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isRehearsalEventName(data.name)) return null;
  return data;
}

async function resultFromEvent(
  eventId: string,
  eventName: string,
  reused: boolean,
): Promise<RehearsalResult> {
  const participants = await listParticipants(eventId);
  const snap = await fetchBracketSnapshot(eventId);
  const teamCount = snap?.participant.length ?? 0;
  return {
    eventId,
    eventName,
    matchesPlayed: 0,
    participantCount: participants.length,
    teamCount,
    reused,
  };
}

/**
 * デモ用 — リハーサルイベントを用意する。
 * URL の eventId が有効ならそれを使用、なければ再利用 → 新規作成。
 */
export async function ensureDemoReady(
  urlEventId: string | null,
  onProgress: (p: RehearsalProgress) => void,
): Promise<RehearsalResult> {
  if (urlEventId) {
    onProgress({ step: '共有 URL のイベントを確認' });
    const event = await loadRehearsalEvent(urlEventId);
    if (event) {
      const snap = await fetchBracketSnapshot(event.id);
      if (snap != null && snap.match.length > 0) {
        onProgress({ step: '準備完了', detail: '共有イベントを使用' });
        return resultFromEvent(event.id, event.name, true);
      }
      onProgress({ step: 'ブラケットを再生成' });
      await resetRehearsalMatches(event.id);
      onProgress({ step: '準備完了' });
      return resultFromEvent(event.id, event.name, true);
    }
  }

  try {
    onProgress({ step: 'サンプルデータを準備' });
    return await reuseRehearsal(onProgress, 0);
  } catch {
    onProgress({ step: '初回セットアップ', detail: '32 名サンプルを登録します' });
    return await createFreshRehearsal(onProgress, 0);
  }
}
