import { supabase } from '../../lib/supabase';
import {
  makeBalancedTeams,
  teamRatingAvg,
  type DrawStrategy,
  type RatedParticipant,
} from './draw';
import { buildDoubleElimination, toStageData, type BracketSnapshot } from '../bracket/manager';
import { getNextMatch } from '../progression/progression';

export interface DrawPreviewTeam {
  memberIds: string[];
  memberNames: string[];
  avgRating: number;
  totalRating: number;
}

export async function clearEventTeams(eventId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('event_id', eventId);
  if (error) throw error;
}

export async function confirmDrawAndBuildBracket(
  eventId: string,
  teams: string[][],
  strategy: DrawStrategy,
  memberNames: Map<string, string>,
): Promise<BracketSnapshot> {
  if (teams.length < 2) {
    throw new Error('ブラケット生成には2チーム以上必要です');
  }

  await clearEventTeams(eventId);

  const teamIds: string[] = [];
  for (let seed = 0; seed < teams.length; seed++) {
    const memberIds = teams[seed];
    const label = memberIds.map((id) => memberNames.get(id) ?? '?').join(' & ');

    const { data: teamRow, error: teamError } = await supabase
      .from('teams')
      .insert({
        event_id: eventId,
        seed,
        display_name: label,
      })
      .select('id')
      .single();

    if (teamError || !teamRow) throw teamError ?? new Error('チーム作成に失敗しました');

    teamIds.push(teamRow.id);

    const { error: membersError } = await supabase.from('team_members').insert(
      memberIds.map((participant_id) => ({
        team_id: teamRow.id,
        participant_id,
      })),
    );
    if (membersError) throw membersError;
  }

  const snapshot = await buildDoubleElimination(teamIds);

  for (const p of snapshot.participant) {
    const teamId = p.name;
    if (!teamIds.includes(teamId)) continue;
    const { error } = await supabase
      .from('teams')
      .update({ manager_participant_id: p.id })
      .eq('id', teamId);
    if (error) throw error;
  }

  const { error: eventError } = await supabase
    .from('events')
    .update({
      odd_strategy: strategy,
      bracket_snapshot: snapshot,
      current_match_id: getNextMatch(toStageData(snapshot))?.id ?? null,
      status: 'setup',
    })
    .eq('id', eventId);

  if (eventError) throw eventError;
  return snapshot;
}

export function previewDraw(
  participants: RatedParticipant[],
  participantNames: Map<string, string>,
  strategy: DrawStrategy,
): DrawPreviewTeam[] {
  const ratingById = new Map(participants.map((p) => [p.id, p.rating]));
  return makeBalancedTeams(participants, strategy).map((memberIds) => ({
    memberIds,
    memberNames: memberIds.map((id) => participantNames.get(id) ?? '?'),
    avgRating: teamRatingAvg(memberIds, ratingById),
    totalRating: memberIds.reduce((s, id) => s + (ratingById.get(id) ?? 0), 0),
  }));
}

export async function resetBracket(eventId: string): Promise<void> {
  await clearEventTeams(eventId);
  const { error } = await supabase
    .from('events')
    .update({ bracket_snapshot: null, current_match_id: null })
    .eq('id', eventId);
  if (error) throw error;
}
