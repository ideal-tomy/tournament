import { supabase } from '../../lib/supabase';
import {
  createManagerFromSnapshot,
  exportSnapshot,
  isFullSnapshot,
  toStageData,
  type BracketSnapshot,
} from '../bracket/manager';
import type { StageData } from '../bracket/layout';
import {
  applyResult,
  deriveEventStatus,
  getChampionTeamId,
  getNextMatch,
  getSlotTeamUuid,
  isTournamentFinished,
  countPlayableMatches,
  ProgressionError,
  type ProgressionError as ProgressionErrorType,
} from './progression';
import { syncMatchesFromSnapshot, resolveMatchUuid } from '../scene/syncMatchesFromSnapshot';
import { requestForceComplete, transitionScene } from '../scene/sceneActions';
import type { EventStatus } from '../../types';

export interface ProgressionState {
  snapshot: BracketSnapshot;
  stageView: StageData;
  currentMatchId: number | null;
  status: EventStatus;
  remainingMatches: number;
  championTeamId: string | null;
}

export async function fetchProgressionState(
  eventId: string,
): Promise<ProgressionState | null> {
  const { data, error } = await supabase
    .from('events')
    .select('bracket_snapshot, bm_current_match_id, status')
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.bracket_snapshot) return null;

  const snapshot = data.bracket_snapshot as BracketSnapshot | StageData;
  if (!isFullSnapshot(snapshot)) {
    throw new Error('ブラケット形式が古いです。抽選タブで再生成してください');
  }
  const manager = createManagerFromSnapshot(snapshot);
  const stageView = toStageData(snapshot);
  const finished = await isTournamentFinished(manager);
  const championTeamId = finished ? await getChampionTeamId(manager) : null;

  return {
    snapshot,
    stageView,
    currentMatchId: finished
      ? null
      : (data.bm_current_match_id ?? getNextMatch(stageView)?.id ?? null),
    status: deriveEventStatus(stageView, finished),
    remainingMatches: finished ? 0 : countPlayableMatches(stageView),
    championTeamId,
  };
}

export interface ConfirmMatchResult {
  snapshot: BracketSnapshot;
  stageView: StageData;
  currentMatchId: number | null;
  status: EventStatus;
  winnerTeamId: string;
  loserTeamId: string | null;
  championTeamId: string | null;
  matchUuid: string | null;
  bmMatchId: number;
}

export async function confirmMatchResult(
  eventId: string,
  matchId: number,
  winnerSlot: 0 | 1,
  currentMatchId: number | null,
): Promise<ConfirmMatchResult> {
  const { data: row, error: fetchError } = await supabase
    .from('events')
    .select('bracket_snapshot, bm_current_match_id')
    .eq('id', eventId)
    .single();

  if (fetchError || !row?.bracket_snapshot) {
    throw new Error('ブラケットが見つかりません');
  }

  const snapshot = row.bracket_snapshot as BracketSnapshot | StageData;
  if (!isFullSnapshot(snapshot)) {
    throw new Error('ブラケット形式が古いです。抽選タブで再生成してください');
  }
  const stageView = toStageData(snapshot);
  const manager = createManagerFromSnapshot(snapshot);
  const effectiveCurrent =
    currentMatchId ?? row.bm_current_match_id ?? getNextMatch(stageView)?.id ?? null;

  await applyResult(manager, stageView, matchId, winnerSlot, effectiveCurrent);

  const fullSnapshot = await exportSnapshot(manager);
  const updatedView = toStageData(fullSnapshot);
  const finished = await isTournamentFinished(manager);
  const nextMatch = finished ? null : getNextMatch(updatedView);
  const status = deriveEventStatus(updatedView, finished);
  const championTeamId = finished ? await getChampionTeamId(manager) : null;

  const match = updatedView.match.find((m) => m.id === matchId);
  if (!match) throw new Error('試合が見つかりません');

  const winnerTeamId = getSlotTeamUuid(updatedView, match, winnerSlot);
  if (!winnerTeamId) throw new Error('勝者チームを特定できません');

  const loserSlot = (winnerSlot === 0 ? 1 : 0) as 0 | 1;
  const loserTeamId = getSlotTeamUuid(updatedView, match, loserSlot);

  const { error: updateError } = await supabase
    .from('events')
    .update({
      bracket_snapshot: fullSnapshot,
      bm_current_match_id: nextMatch?.id ?? null,
      status,
    })
    .eq('id', eventId);

  if (updateError) throw updateError;

  const bmToUuid = await syncMatchesFromSnapshot(eventId, updatedView);
  const matchUuid = bmToUuid.get(matchId) ?? (await resolveMatchUuid(eventId, matchId));

  await transitionScene(eventId, 'result', {
    force: true,
    awaitingOperator: false,
    currentMatchId: matchUuid,
    payload: {
      bmMatchId: matchId,
      matchId: matchUuid,
      winnerTeamId,
      loserTeamId,
      nextBmMatchId: nextMatch?.id ?? null,
      tournamentFinished: finished,
      championTeamId,
    },
  });

  if (status === 'finished') {
    // result 演出後に Admin / Display が finished へ。ここでは status のみ反映済み。
  }

  return {
    snapshot: fullSnapshot,
    stageView: updatedView,
    currentMatchId: nextMatch?.id ?? null,
    status,
    winnerTeamId,
    loserTeamId,
    championTeamId,
    matchUuid,
    bmMatchId: matchId,
  };
}

export async function undoToSnapshot(
  eventId: string,
  previousSnapshot: BracketSnapshot,
  previousCurrentMatchId: number | null,
): Promise<ProgressionState> {
  const manager = createManagerFromSnapshot(previousSnapshot);
  const stageView = toStageData(previousSnapshot);
  const finished = await isTournamentFinished(manager);
  const status = deriveEventStatus(stageView, finished);
  const championTeamId = finished ? await getChampionTeamId(manager) : null;

  const { error } = await supabase
    .from('events')
    .update({
      bracket_snapshot: previousSnapshot,
      bm_current_match_id: previousCurrentMatchId,
      status,
    })
    .eq('id', eventId);

  if (error) throw error;

  await syncMatchesFromSnapshot(eventId, stageView);
  await transitionScene(eventId, 'bracket', { force: true });

  return {
    snapshot: previousSnapshot,
    stageView,
    currentMatchId: previousCurrentMatchId,
    status,
    remainingMatches: finished ? 0 : countPlayableMatches(stageView),
    championTeamId,
  };
}

export async function skipEffects(eventId: string): Promise<void> {
  await requestForceComplete(eventId);
}

export function isProgressionError(e: unknown): e is ProgressionErrorType {
  return e instanceof ProgressionError;
}

/** Vitest / 内部用: snapshot を DB 形式で export */
export async function exportFromSnapshot(snapshot: BracketSnapshot): Promise<BracketSnapshot> {
  const manager = createManagerFromSnapshot(snapshot);
  return exportSnapshot(manager);
}
