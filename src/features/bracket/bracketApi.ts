import { supabase } from '../../lib/supabase';
import { toStageData } from './manager';
import type { StageData } from './layout';
import type { EventStatus } from '../../types';

export interface BracketDisplayMeta {
  snapshot: StageData | null;
  currentMatchId: number | null;
  status: EventStatus;
}

export async function fetchBracketDisplayMeta(eventId: string): Promise<BracketDisplayMeta> {
  const { data, error } = await supabase
    .from('events')
    .select('bracket_snapshot, bm_current_match_id, status')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.bracket_snapshot) {
    return { snapshot: null, currentMatchId: null, status: 'entry' };
  }

  return {
    snapshot: toStageData(data.bracket_snapshot as Parameters<typeof toStageData>[0]),
    currentMatchId: data.bm_current_match_id ?? null,
    status: (data.status as EventStatus) ?? 'entry',
  };
}

export async function fetchBracketSnapshot(eventId: string): Promise<StageData | null> {
  const meta = await fetchBracketDisplayMeta(eventId);
  return meta.snapshot;
}

export function hasBracket(snapshot: StageData | null): boolean {
  return snapshot != null && snapshot.match.length > 0;
}
