import { supabase } from '../../lib/supabase';
import { toStageData } from './manager';
import type { StageData } from './layout';

export async function fetchBracketSnapshot(eventId: string): Promise<StageData | null> {
  const { data, error } = await supabase
    .from('events')
    .select('bracket_snapshot')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.bracket_snapshot) return null;
  return toStageData(data.bracket_snapshot as Parameters<typeof toStageData>[0]);
}

export function hasBracket(snapshot: StageData | null): boolean {
  return snapshot != null && snapshot.match.length > 0;
}
