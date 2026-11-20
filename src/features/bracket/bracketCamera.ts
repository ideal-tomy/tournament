import { Status } from 'brackets-model';
import { computeBracketLayout, type BracketKind, type StageData } from './layout';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';
import { losersColumns } from './losersBoard';

export type VenueBoardSide = 'winners' | 'losers' | 'grand_final';

function kindFor(side: VenueBoardSide): BracketKind {
  if (side === 'losers') return 'loser';
  if (side === 'grand_final') return 'grand_final';
  return 'winner';
}

function roundOf(data: StageData, matchId: number | null | undefined): number | null {
  if (matchId == null) return null;
  const match = data.match.find((row) => row.id === matchId);
  return match ? getMatchRoundLabel(data, match) : null;
}

/** 進行中 → 呼び出し中 → 未了の一番下。会場の表が映す回戦。 */
export function venueFocusRound(
  data: StageData,
  side: VenueBoardSide,
  focus: {
    liveMatchIds?: Array<number | null | undefined>;
    calledMatchIds?: Array<number | null | undefined>;
    highlightMatchId?: number | null;
  } = {},
): number {
  const kind = kindFor(side);
  for (const id of focus.liveMatchIds ?? []) {
    const round = roundOf(data, id);
    if (round != null) return round;
  }
  for (const id of focus.calledMatchIds ?? []) {
    const round = roundOf(data, id);
    if (round != null) return round;
  }
  if (focus.highlightMatchId != null) {
    const round = roundOf(data, focus.highlightMatchId);
    if (round != null) return round;
  }
  const rounds = new Map<number, boolean>();
  for (const match of data.match) {
    if (getMatchBracketKind(data, match) !== kind) continue;
    const round = getMatchRoundLabel(data, match);
    const open = match.status < Status.Completed;
    rounds.set(round, (rounds.get(round) ?? false) || open);
  }
  const ordered = [...rounds.keys()].sort((a, b) => a - b);
  for (const round of ordered) {
    if (rounds.get(round)) return round;
  }
  return ordered[ordered.length - 1] ?? 1;
}

/** いまの回戦と、その次の1列。 */
export function venueCameraRounds(focusRound: number, maxRound: number): number[] {
  if (maxRound < 1) return [Math.max(1, focusRound)];
  const current = Math.min(Math.max(1, focusRound), maxRound);
  return current < maxRound ? [current, current + 1] : [current];
}

/** 進行中は両台だけ。勝利確定後は次の枠だけ。 */
export function venuePulseMatchIds(input: {
  liveMatchIds: number[];
  resultMatchIds: number[];
  nextIdOf: (matchId: number) => number | null;
}): number[] {
  const ids = new Set<number>();
  for (const id of input.liveMatchIds) ids.add(id);
  for (const id of input.resultMatchIds) {
    const next = input.nextIdOf(id);
    if (next != null) ids.add(next);
  }
  return [...ids];
}

export function losersNextId(data: StageData, matchId: number): number | null {
  return losersColumns(data).flatMap((column) => column.matches).find((match) => match.id === matchId)?.nextId ?? null;
}

export function winnersNextId(data: StageData, matchId: number): number | null {
  return computeBracketLayout(data, undefined, 'winners').connectors
    .find((connector) => connector.kind === 'advance' && connector.fromMatchId === matchId)
    ?.toMatchId ?? null;
}

export function venueNextMatchId(data: StageData, side: VenueBoardSide, matchId: number): number | null {
  if (side === 'losers') return losersNextId(data, matchId);
  if (side === 'winners') return winnersNextId(data, matchId);
  return computeBracketLayout(data, undefined, 'grand_final').connectors
    .find((connector) => connector.kind === 'advance' && connector.fromMatchId === matchId)
    ?.toMatchId ?? null;
}

/** 待ち文言を意味の切れ目で2行にする。 */
export function splitLoserWaitSource(source: string): [string, string] {
  const winner = source.match(/^(ウィナーズ .+|ルーザーズ .+)の勝者$/);
  if (winner) return [winner[1], '勝者を待機'];
  const loser = source.match(/^(ウィナーズ .+|ルーザーズ .+)の敗者$/);
  if (loser) return [loser[1], '敗者を待機'];
  return [source, '待機'];
}
