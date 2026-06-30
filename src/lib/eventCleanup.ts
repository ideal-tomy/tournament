import { supabase } from './supabase';
import { broadcast } from './realtime';

async function removeStoragePrefix(bucket: string, eventId: string): Promise<void> {
  const { data: files, error } = await supabase.storage.from(bucket).list(eventId);
  if (error) throw error;
  if (!files?.length) return;

  const paths = files.map((f) => `${eventId}/${f.name}`);
  const { error: delError } = await supabase.storage.from(bucket).remove(paths);
  if (delError) throw delError;
}

/**
 * 大会終了 + 肖像データ削除（不可逆）。
 * teams → participants の順で削除し、Storage も eventId プレフィックスごと削除。
 */
export async function finishAndPurgePortraitData(eventId: string): Promise<void> {
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
