import type { BracketsManager } from 'brackets-manager';
import { Status } from 'brackets-model';
import type { BMMatch, StageData } from '../bracket/layout';
import { toStageData } from '../bracket/manager';

export class ProgressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressionError';
  }
}

/** brackets-manager participant.id → team UUID (participant.name) */
export function participantIdToTeamUuid(
  data: StageData,
  participantId: number,
): string | null {
  const p = data.participant.find((row) => row.id === participantId);
  return p?.name ?? null;
}

export function getSlotTeamUuid(
  data: StageData,
  match: BMMatch,
  slot: 0 | 1,
): string | null {
  const opp = slot === 0 ? match.opponent1 : match.opponent2;
  if (opp?.id == null) return null;
  return participantIdToTeamUuid(data, opp.id as number);
}

export function getMatchBracketKind(
  data: StageData,
  match: BMMatch,
): 'winner' | 'loser' | 'grand_final' {
  const group = data.group.find((g) => g.id === match.group_id);
  const num = group?.number ?? 1;
  if (num === 1) return 'winner';
  if (num === 2) return 'loser';
  return 'grand_final';
}

export function getMatchRoundLabel(data: StageData, match: BMMatch): number {
  const round = data.round.find((r) => r.id === match.round_id);
  return round?.number ?? 1;
}

/** 両者確定済み・未確定の先頭 match（id 昇順） */
export function getNextMatch(data: StageData): BMMatch | null {
  const sorted = [...data.match].sort((a, b) => a.id - b.id);
  for (const m of sorted) {
    if (m.status !== Status.Ready && m.status !== Status.Running) continue;
    if (m.opponent1?.id != null || m.opponent2?.id != null) return m;
  }
  return null;
}

export function countPlayableMatches(data: StageData): number {
  return data.match.filter(
    (m) =>
      (m.status === Status.Ready || m.status === Status.Running) &&
      (m.opponent1?.id != null || m.opponent2?.id != null),
  ).length;
}

export function deriveEventStatus(
  data: StageData,
  finished: boolean,
): 'setup' | 'running' | 'finished' {
  if (finished) return 'finished';
  const started = data.match.some((m) => m.status >= Status.Completed);
  return started ? 'running' : 'setup';
}

export async function isTournamentFinished(
  manager: BracketsManager,
): Promise<boolean> {
  try {
    await manager.get.finalStandings(0);
    return true;
  } catch {
    return false;
  }
}

export async function getChampionTeamId(
  manager: BracketsManager,
): Promise<string | null> {
  try {
    const standings = await manager.get.finalStandings(0);
    const top = standings[0];
    if (!top?.name) return null;
    return String(top.name);
  } catch {
    return null;
  }
}

function matchHasWinner(match: BMMatch, winnerSlot: 0 | 1): boolean {
  const win = winnerSlot === 0 ? match.opponent1 : match.opponent2;
  const lose = winnerSlot === 0 ? match.opponent2 : match.opponent1;
  return win?.result === 'win' && lose?.result === 'loss';
}

export function validateMatchApply(
  data: StageData,
  matchId: number,
  winnerSlot: 0 | 1,
  currentMatchId: number | null,
): BMMatch {
  const match = data.match.find((m) => m.id === matchId);
  if (!match) throw new ProgressionError('試合が見つかりません');

  if (match.status === Status.Completed || match.status === Status.Archived) {
    if (matchHasWinner(match, winnerSlot)) return match;
    throw new ProgressionError('この試合は既に確定済みです');
  }

  if (match.status !== Status.Ready && match.status !== Status.Running) {
    throw new ProgressionError('この試合はまだ開始できません');
  }

  const next = getNextMatch(data);
  const allowed =
    currentMatchId == null
      ? next?.id === matchId
      : matchId === currentMatchId || next?.id === matchId;

  if (!allowed) {
    throw new ProgressionError('現在の試合と一致しません');
  }

  const winnerId = winnerSlot === 0 ? match.opponent1?.id : match.opponent2?.id;
  if (winnerId == null) {
    throw new ProgressionError('勝者側に参加者がいません');
  }

  return match;
}

/** 勝敗適用（brackets-manager に委譲）。既に同じ結果ならそのまま export */
export async function applyResult(
  manager: BracketsManager,
  data: StageData,
  matchId: number,
  winnerSlot: 0 | 1,
  currentMatchId: number | null,
): Promise<StageData> {
  const match = validateMatchApply(data, matchId, winnerSlot, currentMatchId);

  if (match.status === Status.Completed || match.status === Status.Archived) {
    return toStageData(await manager.get.stageData(0));
  }

  await manager.update.match({
    id: matchId,
    opponent1: { result: winnerSlot === 0 ? 'win' : 'loss' },
    opponent2: { result: winnerSlot === 1 ? 'win' : 'loss' },
  });

  return toStageData(await manager.get.stageData(0));
}
