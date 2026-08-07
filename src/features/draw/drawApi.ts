import { supabase } from '../../lib/supabase';
import {
  buildRevealOrder,
  makeBalancedTeams,
  teamRatingAvg,
  type DrawStrategy,
  type RatedParticipant,
} from './draw';
import { buildDoubleElimination, toStageData, type BracketSnapshot } from '../bracket/manager';
import { getNextMatch } from '../progression/progression';
import { syncMatchesFromSnapshot } from '../scene/syncMatchesFromSnapshot';
import { transitionScene } from '../scene/sceneActions';
import { estimateDrawDurationSec } from '../presentation/drawAnimationTiming';

export interface DrawPreviewTeam {
  memberIds: string[];
  memberNames: string[];
  avgRating: number;
  totalRating: number;
}

export interface DrawRevealParticipant {
  id: string;
  displayName: string;
  faceUrl: string | null;
}

export interface DrawPresentationData {
  sessionId: string;
  teamSize: number;
  participants: DrawRevealParticipant[];
}

export async function clearEventTeams(eventId: string): Promise<void> {
  await supabase.from('matches').delete().eq('event_id', eventId);
  const { error } = await supabase.from('teams').delete().eq('event_id', eventId);
  if (error) throw error;
}

export async function fetchDrawPresentation(
  eventId: string,
  drawSessionId?: string,
): Promise<DrawPresentationData> {
  let sessionQuery = supabase
    .from('draw_sessions')
    .select('id, reveal_order')
    .eq('event_id', eventId)
    .not('committed_at', 'is', null);
  sessionQuery = drawSessionId
    ? sessionQuery.eq('id', drawSessionId)
    : sessionQuery.order('committed_at', { ascending: false }).limit(1);

  const { data: session, error: sessionError } = await sessionQuery.maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('確定済みの抽選セッションがありません');

  const revealOrder = Array.isArray(session.reveal_order)
    ? session.reveal_order.filter((id): id is string => typeof id === 'string')
    : [];
  const [{ data: event, error: eventError }, { data: participants, error: participantError }] =
    await Promise.all([
      supabase.from('events').select('team_size').eq('id', eventId).single(),
      supabase
        .from('participants')
        .select('id, display_name, face_crop_path, photo_url')
        .eq('event_id', eventId),
    ]);
  if (eventError) throw eventError;
  if (participantError) throw participantError;

  const byId = new Map((participants ?? []).map((participant) => [participant.id, participant]));
  return {
    sessionId: session.id as string,
    teamSize: Math.max(1, Number(event.team_size) || 2),
    participants: revealOrder.map((id) => {
      const participant = byId.get(id);
      const path = participant?.face_crop_path as string | null | undefined;
      const publicFace = path
        ? supabase.storage.from('participant-faces').getPublicUrl(path).data.publicUrl
        : null;
      return {
        id,
        displayName: (participant?.display_name as string | undefined) ?? '参加者',
        faceUrl: publicFace ?? (participant?.photo_url as string | null | undefined) ?? null,
      };
    }),
  };
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
        name: label,
      })
      .select('id')
      .single();

    if (teamError || !teamRow) throw teamError ?? new Error('チーム作成に失敗しました');

    teamIds.push(teamRow.id);

    const { error: membersError } = await supabase.from('team_members').insert(
      memberIds.map((participant_id, idx) => ({
        team_id: teamRow.id,
        participant_id,
        position: idx + 1,
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

  const stage = toStageData(snapshot);
  const { error: eventError } = await supabase
    .from('events')
    .update({
      odd_strategy: strategy,
      bracket_snapshot: snapshot,
      bm_current_match_id: getNextMatch(stage)?.id ?? null,
      status: 'drawn',
      draw_mode: 'rating_balanced',
    })
    .eq('id', eventId);

  if (eventError) throw eventError;

  await syncMatchesFromSnapshot(eventId, stage);

  const revealOrder = buildRevealOrder(teams);
  const { data: drawSession, error: drawSessionError } = await supabase
    .from('draw_sessions')
    .insert({
      event_id: eventId,
      mode: 'rating_balanced',
      reveal_order: revealOrder,
      committed_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (drawSessionError || !drawSession) {
    throw drawSessionError ?? new Error('抽選セッションの保存に失敗しました');
  }

  await transitionScene(eventId, 'draw', {
    force: true,
    presentationMode: 'full',
    payload: {
      drawSessionId: drawSession.id,
      participantCount: revealOrder.length,
      teamCount: teams.length,
      durationSec: estimateDrawDurationSec(revealOrder.length, 'full', teams.length),
    },
  });
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
  const { error: sessionsError } = await supabase
    .from('draw_sessions')
    .delete()
    .eq('event_id', eventId);
  if (sessionsError) throw sessionsError;
  const { error } = await supabase
    .from('events')
    .update({
      bracket_snapshot: null,
      bm_current_match_id: null,
      status: 'entry',
    })
    .eq('id', eventId);
  if (error) throw error;
  await transitionScene(eventId, 'idle', { force: true });
}
