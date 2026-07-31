import { Status } from 'brackets-model';
import { supabase } from '../../lib/supabase';
import {
  computeBracketLayout,
  type BracketKind,
  type StageData,
} from '../bracket/layout';
import {
  getMatchBracketKind,
  getMatchRoundLabel,
  getSlotTeamUuid,
  participantIdToTeamUuid,
} from '../progression/progression';
import type { BracketThemeKey } from '../../types';

function toThemeKey(kind: BracketKind): BracketThemeKey {
  if (kind === 'winner') return 'winners';
  if (kind === 'loser') return 'losers';
  return 'grand_final';
}

function matchStatus(status: number): string {
  if (status >= Status.Completed) return 'done';
  if (status === Status.Running) return 'in_progress';
  if (status === Status.Ready) return 'ready';
  return 'pending';
}

/**
 * bracket_snapshot → matches 投影。
 * layout.bmMatchId で brackets-manager の match.id と紐づける。
 */
export async function syncMatchesFromSnapshot(
  eventId: string,
  stage: StageData,
): Promise<Map<number, string>> {
  const layout = computeBracketLayout(stage);
  const bmToUuid = new Map<number, string>();

  const { data: existing, error: exErr } = await supabase
    .from('matches')
    .select('id, layout')
    .eq('event_id', eventId);
  if (exErr) throw exErr;

  for (const row of existing ?? []) {
    const bmId = (row.layout as { bmMatchId?: number } | null)?.bmMatchId;
    if (bmId != null) bmToUuid.set(bmId, row.id as string);
  }

  const sorted = [...stage.match].sort((a, b) => a.id - b.id);

  for (const m of sorted) {
    const kind = getMatchBracketKind(stage, m);
    const round = getMatchRoundLabel(stage, m);
    const ml = layout.byId[m.id];
    const teamA = getSlotTeamUuid(stage, m, 0);
    const teamB = getSlotTeamUuid(stage, m, 1);

    let winner: string | null = null;
    let loser: string | null = null;
    if (m.opponent1?.result === 'win') {
      winner = teamA;
      loser = teamB;
    } else if (m.opponent2?.result === 'win') {
      winner = teamB;
      loser = teamA;
    }

    const layoutJson = {
      bmMatchId: m.id,
      box: ml?.box ?? null,
      center: ml?.center ?? null,
      bracket: kind,
    };

    const payload = {
      event_id: eventId,
      bracket: toThemeKey(kind),
      round,
      match_no: m.number,
      sequence: m.id,
      team_a_id: teamA,
      team_b_id: teamB,
      winner_team_id: winner,
      loser_team_id: loser,
      status: matchStatus(m.status),
      layout: layoutJson,
      finished_at: m.status >= Status.Completed ? new Date().toISOString() : null,
    };

    const existingId = bmToUuid.get(m.id);
    if (existingId) {
      const { error } = await supabase.from('matches').update(payload).eq('id', existingId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('matches')
        .insert(payload)
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('matches insert failed');
      bmToUuid.set(m.id, data.id as string);
    }
  }

  // next_* リンク（connector から）
  for (const c of layout.connectors) {
    const fromId = bmToUuid.get(c.fromMatchId);
    const toId = bmToUuid.get(c.toMatchId);
    if (!fromId || !toId) continue;
    if (c.kind === 'advance') {
      await supabase
        .from('matches')
        .update({ next_win_match_id: toId, next_win_slot: 1 })
        .eq('id', fromId);
    } else {
      await supabase
        .from('matches')
        .update({ next_lose_match_id: toId, next_lose_slot: 1 })
        .eq('id', fromId);
    }
  }

  // 削除された BM match を掃除（再抽選時は clearEventTeams で消える）
  const keep = new Set(bmToUuid.values());
  for (const row of existing ?? []) {
    if (!keep.has(row.id as string)) {
      await supabase.from('matches').delete().eq('id', row.id);
    }
  }

  return bmToUuid;
}

export async function resolveMatchUuid(
  eventId: string,
  bmMatchId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, layout')
    .eq('event_id', eventId);
  if (error) throw error;
  for (const row of data ?? []) {
    if ((row.layout as { bmMatchId?: number })?.bmMatchId === bmMatchId) {
      return row.id as string;
    }
  }
  return null;
}

export function teamUuidFromParticipantName(
  stage: StageData,
  participantId: number | null | undefined,
): string | null {
  if (participantId == null) return null;
  return participantIdToTeamUuid(stage, participantId);
}
