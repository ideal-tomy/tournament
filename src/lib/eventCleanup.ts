import { supabase } from './supabase';
import { resetBracket } from '../features/draw/drawApi';
import { isRehearsalEventTitle } from './event';
import { transitionScene } from '../features/scene/sceneActions';

async function removeStoragePrefix(bucket: string, eventId: string): Promise<void> {
  const { data: files, error } = await supabase.storage.from(bucket).list(eventId);
  if (error) throw error;
  if (!files?.length) return;

  const paths = files.map((f) => `${eventId}/${f.name}`);
  const { error: delError } = await supabase.storage.from(bucket).remove(paths);
  if (delError) throw delError;
}

/**
 * リハーサル用 — ブラケットのみクリア。参加者・Storage は維持。
 */
export async function finishRehearsalSoft(eventId: string): Promise<void> {
  await resetBracket(eventId);
  const { error } = await supabase
    .from('events')
    .update({ status: 'entry' })
    .eq('id', eventId);
  if (error) throw error;
  await transitionScene(eventId, 'idle', { force: true });
}

/**
 * 大会終了 + 肖像データ削除（不可逆・本番用）。
 * teams → participants の順で削除し、Storage も eventId プレフィックスごと削除。
 */
export async function finishAndPurgePortraitData(eventId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('events')
    .select('title')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (row && isRehearsalEventTitle(row.title as string)) {
    throw new Error(
      'リハーサルイベントでは肖像データの完全削除はできません。「試合リセット」または「リハーサル終了（データ維持）」をご利用ください。',
    );
  }

  const { error: statusError } = await supabase
    .from('events')
    .update({
      status: 'finished',
      bracket_snapshot: null,
      bm_current_match_id: null,
    })
    .eq('id', eventId);

  if (statusError) throw statusError;

  await transitionScene(eventId, 'finished', { force: true });

  await removeStoragePrefix('participant-photos', eventId);
  await removeStoragePrefix('participant-faces', eventId);

  await supabase.from('matches').delete().eq('event_id', eventId);

  const { error: teamError } = await supabase.from('teams').delete().eq('event_id', eventId);
  if (teamError) throw teamError;

  const { error: partError } = await supabase
    .from('participants')
    .delete()
    .eq('event_id', eventId);

  if (partError) throw partError;
}
