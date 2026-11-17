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

function isRealMatch(m: BMMatch): boolean {
  return m.opponent1 !== null && m.opponent2 !== null;
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

export type BoardSide = 'winners' | 'losers' | 'grand_final';

type ChapterKey = { kind: 'winner' | 'loser' | 'grand_final'; round: number };

function chapterOf(data: StageData, match: BMMatch): ChapterKey {
  return { kind: getMatchBracketKind(data, match), round: getMatchRoundLabel(data, match) };
}

function sameChapter(a: ChapterKey, b: ChapterKey) {
  return a.kind === b.kind && a.round === b.round;
}

function readyPlayable(data: StageData, exclude: ReadonlySet<number>): BMMatch[] {
  return data.match.filter(
    (m) =>
      m.status === Status.Ready &&
      m.opponent1?.id != null &&
      m.opponent2?.id != null &&
      !exclude.has(m.id),
  );
}

function sortReady(matches: BMMatch[]): BMMatch[] {
  return [...matches].sort((a, b) => a.number - b.number || a.id - b.id);
}

function filterChapter(data: StageData, matches: BMMatch[], chapter: ChapterKey): BMMatch[] {
  return sortReady(matches.filter((m) => sameChapter(chapterOf(data, m), chapter)));
}

function hasLosersBracket(data: StageData): boolean {
  return data.group.some((g) => g.number === 2);
}

/** 無敗が4チームになるウィナーズの回。32枠なら3回戦。 */
function winnersCutRound(data: StageData): number {
  const firstRound = data.match.filter(
    (m) => getMatchBracketKind(data, m) === 'winner' && getMatchRoundLabel(data, m) === 1,
  ).length;
  let remaining = Math.max(2, firstRound * 2);
  let round = 0;
  while (remaining > 4) {
    remaining /= 2;
    round += 1;
  }
  return round;
}

function roundHasBegun(data: StageData, chapter: ChapterKey): boolean {
  return data.match.some(
    (m) => sameChapter(chapterOf(data, m), chapter) && isRealMatch(m) && m.status >= Status.Running,
  );
}

/**
 * 会場の章に沿った次試合。不戦勝（相手が空）は数えない。
 * exclude は返却から外すだけで、章の判定には台に載っている Ready/Running も含める。
 * DE: 無敗が4チームになる回までウィナーズ。そのあとルーザーズを続け、
 * 戻ったウィナーズの残りも、途中でルーザーズへ切り替えずに終える。
 * SE: 未了の一番下の回だけ。
 */
export function getChapterMatches(data: StageData, exclude: ReadonlySet<number> = new Set()): BMMatch[] {
  const allReady = readyPlayable(data, new Set());
  const ready = allReady.filter((m) => !exclude.has(m.id));
  const open = data.match.filter(
    (m) =>
      (m.status === Status.Ready || m.status === Status.Running) &&
      m.opponent1?.id != null &&
      m.opponent2?.id != null,
  );
  if (!allReady.length && !open.length) return [];

  if (!hasLosersBracket(data)) {
    const pool = open.length ? open : allReady;
    const tier = Math.min(...pool.map((m) => getMatchTier(data, m)));
    return sortReady(ready.filter((m) => getMatchTier(data, m) === tier));
  }

  const cut = winnersCutRound(data);
  const wbFieldOpen = open.filter(
    (m) => getMatchBracketKind(data, m) === 'winner' && getMatchRoundLabel(data, m) <= cut,
  );
  if (wbFieldOpen.length) {
    const round = Math.min(...wbFieldOpen.map((m) => getMatchRoundLabel(data, m)));
    return filterChapter(data, ready, { kind: 'winner', round });
  }

  const loserReady = allReady.filter((m) => getMatchBracketKind(data, m) === 'loser');
  const winnerReady = allReady.filter((m) => getMatchBracketKind(data, m) === 'winner');
  const gfReady = allReady.filter((m) => getMatchBracketKind(data, m) === 'grand_final');

  const pickLowest = (matches: BMMatch[], kind: ChapterKey['kind']) => {
    const round = Math.min(...matches.map((m) => getMatchRoundLabel(data, m)));
    return filterChapter(data, ready, { kind, round });
  };

  const begunWinnerRounds = [...new Set(
    open
      .filter((m) => getMatchBracketKind(data, m) === 'winner')
      .map((m) => getMatchRoundLabel(data, m))
      .filter((round) => roundHasBegun(data, { kind: 'winner', round })),
  )];
  if (begunWinnerRounds.length) {
    return filterChapter(data, ready, { kind: 'winner', round: Math.min(...begunWinnerRounds) });
  }

  const losersBegun = data.match.some(
    (m) => getMatchBracketKind(data, m) === 'loser' && isRealMatch(m) && m.status >= Status.Running,
  );
  const winnersReturnBegun = data.match.some(
    (m) =>
      getMatchBracketKind(data, m) === 'winner' &&
      getMatchRoundLabel(data, m) > cut &&
      isRealMatch(m) &&
      m.status >= Status.Running,
  );
  if (losersBegun && winnersReturnBegun && winnerReady.length) return pickLowest(winnerReady, 'winner');
  // Loser rounds: do not jump to a higher Ready round while a lower unfinished round still exists.
  const loserOpen = data.match.filter(
    (m) => getMatchBracketKind(data, m) === 'loser' && isRealMatch(m) && m.status < Status.Completed,
  );
  if (loserOpen.length) {
    const round = Math.min(...loserOpen.map((m) => getMatchRoundLabel(data, m)));
    const chapter = filterChapter(data, ready, { kind: 'loser', round });
    if (chapter.length) return chapter;
    if (loserReady.some((m) => getMatchRoundLabel(data, m) > round)) return [];
  }
  if (loserReady.length) return pickLowest(loserReady, 'loser');
  if (winnerReady.length) return pickLowest(winnerReady, 'winner');
  if (gfReady.length) {
    const round = Math.min(...gfReady.map((m) => getMatchRoundLabel(data, m)));
    return filterChapter(data, ready, { kind: 'grand_final', round });
  }
  return [];
}

function teamKey(data: StageData, match: BMMatch, slot: 0 | 1): string | null {
  const opponent = slot === 0 ? match.opponent1 : match.opponent2;
  if (opponent?.id == null) return null;
  return data.participant.find((row) => row.id === opponent.id)?.name ?? null;
}

/** 実際に両チームが戦って終わった回数。不戦勝は数えない。 */
function matchesPlayed(data: StageData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of data.match) {
    if (match.status < Status.Completed) continue;
    if (match.opponent1?.id == null || match.opponent2?.id == null) continue;
    for (const slot of [0, 1] as const) {
      const id = teamKey(data, match, slot);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** 最後に戦った試合番号。未出場は 0 で、待っている側が先になる。 */
function lastPlayedNumber(data: StageData): Map<string, number> {
  const last = new Map<string, number>();
  for (const match of data.match) {
    if (match.status < Status.Completed) continue;
    if (match.opponent1?.id == null || match.opponent2?.id == null) continue;
    for (const slot of [0, 1] as const) {
      const id = teamKey(data, match, slot);
      if (id) last.set(id, Math.max(last.get(id) ?? 0, match.number));
    }
  }
  return last;
}

/**
 * 同じ章の中で、試合数が少なく、長く待っているチームを先にする。
 * 直前に出たチームは、他の試合があるときだけ後ろへ回す。
 */
function orderCourtMatches(
  data: StageData,
  matches: BMMatch[],
  restingTeamIds: ReadonlySet<string>,
): { matches: BMMatch[]; deferredRest: boolean } {
  const counts = matchesPlayed(data);
  const last = lastPlayedNumber(data);
  const load = (match: BMMatch) => {
    const ids = [teamKey(data, match, 0), teamKey(data, match, 1)];
    return ids.reduce((sum, id) => sum + (id ? counts.get(id) ?? 0 : 0), 0);
  };
  const waited = (match: BMMatch) => {
    const ids = [teamKey(data, match, 0), teamKey(data, match, 1)];
    return ids.reduce((sum, id) => sum + (id ? last.get(id) ?? 0 : 0), 0);
  };
  const involvesRest = (match: BMMatch) => {
    const a = teamKey(data, match, 0);
    const b = teamKey(data, match, 1);
    return (a != null && restingTeamIds.has(a)) || (b != null && restingTeamIds.has(b));
  };
  const byEase = (a: BMMatch, b: BMMatch) => load(a) - load(b) || waited(a) - waited(b) || a.number - b.number || a.id - b.id;
  const fresh = matches.filter((match) => !involvesRest(match)).sort(byEase);
  if (fresh.length) return { matches: fresh, deferredRest: matches.some(involvesRest) };
  return { matches: [...matches].sort(byEase), deferredRest: false };
}

/**
 * 複数台の空き台向け。1台と同じ章だけを出す。
 * グランドファイナルは台に載せない。
 */
export function getCourtFillMatches(
  data: StageData,
  exclude: ReadonlySet<number> = new Set(),
  restingTeamIds: ReadonlySet<string> = new Set(),
): { matches: BMMatch[]; deferredRest: boolean } {
  const chapter = getChapterMatches(data, exclude).filter((match) => getMatchBracketKind(data, match) !== 'grand_final');
  if (!chapter.length) return { matches: [], deferredRest: false };
  return orderCourtMatches(data, chapter, restingTeamIds);
}

export const COURT_WAIT = {
  round: 'この回戦の残りが終わるまで、次の回戦は入れない',
  opponent: 'もう一方の結果が出ると、対戦相手が決まる',
  rest: '直前のチームが続くため、次の1試合を待っています',
  grandFinal: 'グランドファイナルは台には載せません',
} as const;

/** 空き台に試合を入れられない理由。選べる試合があるときは、休息で後回しにしたときだけ文を返す。 */
export function explainCourtFillWait(
  data: StageData,
  exclude: ReadonlySet<number> = new Set(),
  restingTeamIds: ReadonlySet<string> = new Set(),
): string | null {
  const fill = getCourtFillMatches(data, exclude, restingTeamIds);
  if (fill.matches.length) return fill.deferredRest ? COURT_WAIT.rest : null;

  const unfinished = data.match.filter((m) => m.status < Status.Completed);
  if (!unfinished.length) return null;
  const bothSides = (match: BMMatch) => match.opponent1?.id != null && match.opponent2?.id != null;
  const openBoth = unfinished.filter(bothSides);
  const nonFinal = unfinished.filter((m) => getMatchBracketKind(data, m) !== 'grand_final');
  if (!nonFinal.length) return COURT_WAIT.grandFinal;

  if (!hasLosersBracket(data)) {
    const pool = openBoth.length ? openBoth : unfinished;
    const tier = Math.min(...pool.map((m) => getMatchTier(data, m)));
    return openBoth.some((m) => getMatchTier(data, m) === tier) ? COURT_WAIT.round : COURT_WAIT.opponent;
  }

  const earlyWinners = openBoth.filter(
    (m) => getMatchBracketKind(data, m) === 'winner' && getMatchRoundLabel(data, m) <= winnersCutRound(data),
  );
  return earlyWinners.length ? COURT_WAIT.round : COURT_WAIT.opponent;
}

/** 会場の表に出す側。進行中の試合がなければ章の次試合、それもなければウィナー。 */
export function getBoardSide(data: StageData, currentMatchId: number | null = null): BoardSide {
  const current = currentMatchId == null ? null : data.match.find((m) => m.id === currentMatchId);
  const focus =
    current ??
    data.match.find((m) => m.status === Status.Running) ??
    getChapterMatches(data)[0] ??
    null;
  if (!focus) return 'winners';
  const kind = getMatchBracketKind(data, focus);
  if (kind === 'loser') return 'losers';
  if (kind === 'grand_final') return 'grand_final';
  return 'winners';
}
