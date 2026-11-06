import type { BracketsManager } from 'brackets-manager';
import { Status } from 'brackets-model';
import type { BMMatch, StageData } from '../bracket/layout';
import { toStageData } from '../bracket/manager';
export { getBottomTierMatches, getMatchBracketKind, getMatchRoundLabel, getMatchTier, getOpenTierMatches } from './tiers';

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
): 'drawn' | 'running' | 'finished' {
  if (finished) return 'finished';
  const started = data.match.some((m) => m.status >= Status.Completed);
  return started ? 'running' : 'drawn';
}

export async function isTournamentFinished(
  manager: BracketsManager,
): Promise<boolean> {
  return await getChampionTeamId(manager) !== null;
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
    // brackets-manager emits only a winners group for size=2 DE, while
    // finalStandings expects a grand-final group. Read the already committed
    // sole final's result; never infer a winner from seeding or pending matches.
    const snapshot=await manager.get.stageData(0),data=toStageData(snapshot);
    if(snapshot.stage[0]?.settings.size!==2||data.participant.length!==2||data.match.length!==1)return null;
    const final=data.match[0];
    if(final.status<Status.Completed)return null;
    if(final.opponent1?.result==='win'&&final.opponent2?.result==='loss')return getSlotTeamUuid(data,final,0);
    if(final.opponent2?.result==='win'&&final.opponent1?.result==='loss')return getSlotTeamUuid(data,final,1);
    return null;
  }
}

export interface FinalPlacements {
  first: string;
  /** Single elimination without a 3rd-place match ranks both semi-final losers 3rd. */
  second: string[];
  third: string[];
}

export async function getFinalPlacements(
  manager: BracketsManager,
): Promise<FinalPlacements | null> {
  const first = await getChampionTeamId(manager);
  if (!first) return null;
  try {
    const standings = await manager.get.finalStandings(0);
    const at = (rank: number) => standings.filter(s => s.rank === rank && s.name).map(s => String(s.name)).filter(id => id !== first);
    return { first, second: at(2), third: at(3) };
  } catch {
    // Same size=2 gap as getChampionTeamId: the sole final's other team is 2nd.
    const data = toStageData(await manager.get.stageData(0)), final = data.match[0];
    const second = final ? [getSlotTeamUuid(data, final, 0), getSlotTeamUuid(data, final, 1)].filter((id): id is string => !!id && id !== first) : [];
    return { first, second, third: [] };
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
