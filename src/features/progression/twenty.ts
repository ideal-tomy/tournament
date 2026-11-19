import { Status } from 'brackets-model';
import type { BMMatch, StageData } from '../bracket/layout';
import { getMatchBracketKind, getMatchRoundLabel } from './tiers';
import { getActiveWinnersTeamIds } from './winnersAlive';

export type TwentyPhase = 'A' | 'B' | 'C';

export const TWENTY_WAIT = {
  opponent: '対戦相手の確定待ち',
  held: '出場チームが別の台で試合中、または確保済み',
  phase: '今の段階では出さない',
  finished: '大会終了',
} as const;

export const TWENTY_REASON = {
  first: '初戦同士',
  avoidBack: '連戦を避けた',
  rest: '休憩が長いほう',
  order: '同じ条件なので下の回戦',
  backToBack: '他に候補がなく、連戦になる',
} as const;

export type TwentyWait = (typeof TWENTY_WAIT)[keyof typeof TWENTY_WAIT];
export type TwentyReason = (typeof TWENTY_REASON)[keyof typeof TWENTY_REASON];

export interface TwentyCandidate {
  match: BMMatch;
  teamA: string;
  teamB: string;
  playedA: number;
  playedB: number;
  restA: number;
  restB: number;
  reason: TwentyReason | null;
}

export interface TwentyView {
  phase: TwentyPhase;
  candidates: TwentyCandidate[];
  priority: TwentyCandidate | null;
  wait: TwentyWait | null;
  manual: boolean;
  canSwitch: boolean;
  promptSwitch: boolean;
}

export interface TwentyInput {
  data: StageData;
  storedPhase: TwentyPhase;
  reservedMatchIds: ReadonlySet<number>;
  endedAt: ReadonlyMap<number, number>;
  openedAt: number;
  now: number;
}

export function isTwentyDe(data: StageData): boolean {
  return data.participant.length === 20 && data.group.some((group) => group.number === 2);
}

/** 無敗が4チームになるウィナーズの回。32枠なら3。 */
export function winnersFieldRound(data: StageData): number {
  const firstRound = data.match.filter(
    (match) => getMatchBracketKind(data, match) === 'winner' && getMatchRoundLabel(data, match) === 1,
  ).length;
  let remaining = Math.max(2, firstRound * 2);
  let round = 0;
  while (remaining > 4) {
    remaining /= 2;
    round += 1;
  }
  return round;
}

function teamId(data: StageData, match: BMMatch, slot: 0 | 1): string | null {
  const opponent = slot === 0 ? match.opponent1 : match.opponent2;
  if (opponent?.id == null) return null;
  return data.participant.find((row) => row.id === opponent.id)?.name ?? null;
}

function bothTeams(data: StageData, match: BMMatch): [string, string] | null {
  const a = teamId(data, match, 0);
  const b = teamId(data, match, 1);
  return a && b ? [a, b] : null;
}

function real(match: BMMatch): boolean {
  return match.opponent1?.id != null && match.opponent2?.id != null;
}

function playedCounts(data: StageData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of data.match) {
    if (match.status < Status.Completed || !real(match)) continue;
    for (const slot of [0, 1] as const) {
      const id = teamId(data, match, slot);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function lastEnds(data: StageData, endedAt: ReadonlyMap<number, number>): Map<string, number> {
  const last = new Map<string, number>();
  for (const match of data.match) {
    const at = endedAt.get(match.id);
    if (at == null || !real(match)) continue;
    for (const slot of [0, 1] as const) {
      const id = teamId(data, match, slot);
      if (id) last.set(id, Math.max(last.get(id) ?? 0, at));
    }
  }
  return last;
}

function fieldOpen(data: StageData): boolean {
  const cut = winnersFieldRound(data);
  return data.match.some(
    (match) =>
      getMatchBracketKind(data, match) === 'winner' &&
      getMatchRoundLabel(data, match) <= cut &&
      real(match) &&
      match.status < Status.Completed,
  );
}

export function effectivePhase(data: StageData, stored: TwentyPhase): TwentyPhase {
  if (stored === 'C') return 'C';
  const alive = getActiveWinnersTeamIds(data).length;
  const opened = alive > 4 || fieldOpen(data);
  if (stored === 'B') return 'B';
  return opened ? 'A' : 'B';
}

function allowed(data: StageData, match: BMMatch, phase: TwentyPhase): boolean {
  const kind = getMatchBracketKind(data, match);
  const round = getMatchRoundLabel(data, match);
  if (phase === 'A') return kind === 'winner' && round <= winnersFieldRound(data);
  if (phase === 'B') return kind === 'loser';
  return kind === 'winner' || kind === 'loser' || kind === 'grand_final';
}

interface Ranked {
  match: BMMatch;
  teams: [string, string];
  playedA: number;
  playedB: number;
  restA: number;
  restB: number;
  fresh: number;
  back: number;
  minRest: number;
  sideWait: number;
  kind: ReturnType<typeof getMatchBracketKind>;
  round: number;
}

function compare(phase: TwentyPhase, a: Ranked, b: Ranked): number {
  if (a.fresh !== b.fresh) return a.fresh - b.fresh;
  if (a.back !== b.back) return a.back - b.back;
  if (a.minRest !== b.minRest) return b.minRest - a.minRest;
  if (phase === 'C' && a.kind !== b.kind && a.sideWait !== b.sideWait) return b.sideWait - a.sideWait;
  if (a.kind === b.kind && a.round !== b.round) return a.round - b.round;
  if (a.match.number !== b.match.number) return a.match.number - b.match.number;
  return a.match.id - b.match.id;
}

function reasonFor(top: Ranked, rest: Ranked[]): TwentyReason {
  if (top.fresh === 0) return TWENTY_REASON.first;
  if (top.back === 1) return TWENTY_REASON.backToBack;
  if (rest.some((row) => row.back === 1)) return TWENTY_REASON.avoidBack;
  if (rest.some((row) => row.minRest !== top.minRest)) return TWENTY_REASON.rest;
  return TWENTY_REASON.order;
}

export function selectTwenty(input: TwentyInput): TwentyView {
  const phase = effectivePhase(input.data, input.storedPhase);
  const counts = playedCounts(input.data);
  const ends = lastEnds(input.data, input.endedAt);
  const teamIds = input.data.participant.map((row) => String(row.name)).filter((id) => id.length > 0);
  const manual = teamIds.length > 0 && teamIds.every((id) => (counts.get(id) ?? 0) >= 1);
  const latest = Math.max(0, ...input.endedAt.values());
  const justFinished = new Set<string>();
  if (latest > 0) {
    for (const match of input.data.match) {
      if (input.endedAt.get(match.id) !== latest) continue;
      const teams = bothTeams(input.data, match);
      if (teams) teams.forEach((id) => justFinished.add(id));
    }
  }
  const reservedTeams = new Set<string>();
  for (const match of input.data.match) {
    if (!input.reservedMatchIds.has(match.id)) continue;
    const teams = bothTeams(input.data, match);
    if (teams) teams.forEach((id) => reservedTeams.add(id));
  }
  const sideLast = new Map<string, number>();
  for (const match of input.data.match) {
    const at = input.endedAt.get(match.id);
    if (at == null) continue;
    const kind = getMatchBracketKind(input.data, match);
    sideLast.set(kind, Math.max(sideLast.get(kind) ?? 0, at));
  }
  const heldReady: BMMatch[] = [];
  const phaseReady: BMMatch[] = [];
  let pending = false;
  const ranked: Ranked[] = [];
  for (const match of input.data.match) {
    const teams = bothTeams(input.data, match);
    if (!teams) {
      if (match.status < Status.Completed && match.opponent1?.id == null && match.opponent2?.id == null) pending = true;
      continue;
    }
    if (match.status >= Status.Completed) continue;
    const startable = match.status === Status.Ready;
    const blocked = !allowed(input.data, match, phase);
    const reserved = input.reservedMatchIds.has(match.id) || teams.some((id) => reservedTeams.has(id));
    if (!startable) {
      pending = true;
      continue;
    }
    if (blocked) {
      phaseReady.push(match);
      continue;
    }
    if (reserved) {
      heldReady.push(match);
      continue;
    }
    const restA = input.now - (ends.get(teams[0]) ?? input.openedAt);
    const restB = input.now - (ends.get(teams[1]) ?? input.openedAt);
    const kind = getMatchBracketKind(input.data, match);
    ranked.push({
      match,
      teams,
      playedA: counts.get(teams[0]) ?? 0,
      playedB: counts.get(teams[1]) ?? 0,
      restA,
      restB,
      fresh: (counts.get(teams[0]) ?? 0) === 0 && (counts.get(teams[1]) ?? 0) === 0 ? 0 : 1,
      back: teams.some((id) => justFinished.has(id)) ? 1 : 0,
      minRest: Math.min(restA, restB),
      sideWait: input.now - (sideLast.get(kind) ?? input.openedAt),
      kind,
      round: getMatchRoundLabel(input.data, match),
    });
  }
  ranked.sort((a, b) => compare(phase, a, b));
  const why = ranked.length ? reasonFor(ranked[0], ranked.slice(1)) : null;
  const candidates = ranked.map((row, index) => ({
    match: row.match,
    teamA: row.teams[0],
    teamB: row.teams[1],
    playedA: row.playedA,
    playedB: row.playedB,
    restA: row.restA,
    restB: row.restB,
    reason: index === 0 ? why : null,
  }));
  const loserReady = input.data.match.some(
    (match) =>
      getMatchBracketKind(input.data, match) === 'loser' &&
      match.status === Status.Ready &&
      bothTeams(input.data, match) != null &&
      !input.reservedMatchIds.has(match.id) &&
      !(bothTeams(input.data, match)?.some((id) => reservedTeams.has(id))),
  );
  const wait: TwentyWait | null = candidates.length
    ? null
    : heldReady.length
      ? TWENTY_WAIT.held
      : phaseReady.length
        ? TWENTY_WAIT.phase
        : pending
          ? TWENTY_WAIT.opponent
          : TWENTY_WAIT.finished;
  return {
    phase,
    candidates,
    priority: candidates[0] ?? null,
    wait,
    manual,
    canSwitch: phase === 'B',
    promptSwitch: phase === 'B' && !loserReady,
  };
}

/** 呼出の入替。条件を満たさないときは null を返し、呼び出し元は元の試合を維持する。 */
export function reassignCall(input: TwentyInput, boardMatchId: number | null, matchId: number): number | null {
  const reserved = new Set(input.reservedMatchIds);
  if (boardMatchId != null) reserved.delete(boardMatchId);
  const view = selectTwenty({ ...input, reservedMatchIds: reserved });
  if (!view.manual || !view.candidates.some((row) => row.match.id === matchId)) return null;
  return matchId;
}
