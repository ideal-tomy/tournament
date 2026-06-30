import { supabase } from './supabase';
import { broadcast } from './realtime';
import { resetBracket } from '../features/draw/drawApi';
import { isRehearsalEventName } from './event';

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
    .update({ status: 'setup' })
    .eq('id', eventId);
  if (error) throw error;
}

/**
 * 大会終了 + 肖像データ削除（不可逆・本番用）。
 * teams → participants の順で削除し、Storage も eventId プレフィックスごと削除。
 */
export async function finishAndPurgePortraitData(eventId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('events')
    .select('name')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (row && isRehearsalEventName(row.name)) {
    throw new Error(
      'リハーサルイベントでは肖像データの完全削除はできません。「試合リセット」または「リハーサル終了（データ維持）」をご利用ください。',
    );
  }

  const { error: statusError } = await supabase
    .from('events')
    .update({
      status: 'finished',
      bracket_snapshot: null,
      current_match_id: null,
    })
    .eq('id', eventId);

  if (statusError) throw statusError;

  await broadcast(eventId, { type: 'event:finished', eventId });

  await removeStoragePrefix('participant-photos', eventId);
  await removeStoragePrefix('participant-faces', eventId);

  const { error: teamError } = await supabase.from('teams').delete().eq('event_id', eventId);
  if (teamError) throw teamError;

  const { error: partError } = await supabase
    .from('participants')
    .delete()
    .eq('event_id', eventId);

  if (partError) throw partError;
}
