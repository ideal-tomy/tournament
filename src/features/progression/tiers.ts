import { Status } from 'brackets-model';
import type { BMMatch, StageData } from '../bracket/layout';

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

/** 表の段。ウィナーズとルーザーズは同じ回戦が同じ高さ、グランドファイナルはその上 */
export function getMatchTier(data: StageData, match: BMMatch): number {
  const round = getMatchRoundLabel(data, match);
  if (getMatchBracketKind(data, match) !== 'grand_final') return round;
  const top = Math.max(0, ...data.match.filter((m) => getMatchBracketKind(data, m) !== 'grand_final').map((m) => getMatchRoundLabel(data, m)));
  return top + round;
}

/** BYE（opponent が null）の試合は行われないので段の残りに数えない */
function isPendingMatch(m: BMMatch): boolean {
  return m.status < Status.Completed && m.opponent1 !== null && m.opponent2 !== null;
}

/** 最も下の未了の段にある試合（呼び出し前・試合中・相手待ちを含む） */
export function getOpenTierMatches(data: StageData): BMMatch[] {
  const pending = data.match.filter(isPendingMatch);
  if (!pending.length) return [];
  const tier = Math.min(...pending.map((m) => getMatchTier(data, m)));
  return pending.filter((m) => getMatchTier(data, m) === tier);
}

/**
 * 最も下の未了の段で、両組が決まり未開始の試合。
 * 下の段が残っているあいだ、上の段の試合は返さない。
 */
export function getBottomTierMatches(data: StageData, exclude: ReadonlySet<number> = new Set()): BMMatch[] {
  const order = { winner: 0, loser: 1, grand_final: 2 } as const;
  return getOpenTierMatches(data)
    .filter((m) => m.status === Status.Ready && m.opponent1?.id != null && m.opponent2?.id != null && !exclude.has(m.id))
    .sort((a, b) => order[getMatchBracketKind(data, a)] - order[getMatchBracketKind(data, b)] || a.number - b.number || a.id - b.id);
}
