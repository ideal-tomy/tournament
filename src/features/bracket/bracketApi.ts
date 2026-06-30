import { supabase } from '../../lib/supabase';
import type { StageData } from './layout';

export async function fetchBracketSnapshot(eventId: string): Promise<StageData | null> {
  const { data, error } = await supabase
    .from('events')
    .select('bracket_snapshot')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.bracket_snapshot) return null;
  return data.bracket_snapshot as StageData;
}

export function hasBracket(snapshot: StageData | null): boolean {
  return snapshot != null && snapshot.match.length > 0;
}
