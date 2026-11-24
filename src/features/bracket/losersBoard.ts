import { Status } from 'brackets-model';
import type { BMMatch, BMOpponent, Point, StageData } from './layout';

export type LoserSlotStatus = 'done' | 'live' | 'ready' | 'wait';

export interface LoserSlotView {
  teamId: string | null;
  /** 人が未定のとき、その枠が誰を待っているか */
  source: string;
  /** ウィナーズからの落ちか、上の勝者か */
  origin: 'wb_drop' | 'lb_advance' | 'unknown';
}

export interface LoserMatchView {
  id: number;
  round: number;
  number: number;
  status: LoserSlotStatus;
  /** この試合の勝者が入る、次の回戦の試合 */
  nextId: number | null;
  slots: [LoserSlotView, LoserSlotView];
}

export interface LoserColumn {
  round: number;
  matches: LoserMatchView[];
}

/** その段が何の対戦かを表す */
export type LoserRoundKind = 'wb_drop_pair' | 'survivor_vs_drop' | 'survivor_merge';

export interface LosersBoardConfig {
  matchW: number;
  matchH: number;
  matchGap: number;
  roundGap: number;
  headerH: number;
  padding: number;
  gfH: number;
}

export const DEFAULT_LOSERS_BOARD: LosersBoardConfig = {
  matchW: 220,
  matchH: 112,
  matchGap: 28,
  roundGap: 48,
  headerH: 36,
  padding: 24,
  gfH: 56,
};

export interface LosersPlacedMatch extends LoserMatchView {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 上からの勝ち上がりが入るスロット（真下つなぎのとき） */
  advanceSlot: 0 | 1 | null;
}

export interface LosersRoundRow {
  round: number;
  kind: LoserRoundKind;
  label: string;
  y: number;
  matches: LosersPlacedMatch[];
}

export interface LosersConnector {
  fromMatchId: number;
  toMatchId: number;
  from: Point;
  to: Point;
  path: string;
}

export interface LosersGrandFinalSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  fromMatchId: number;
}

export interface LosersBoardLayout {
  rounds: LosersRoundRow[];
  connectors: LosersConnector[];
  grandFinal: LosersGrandFinalSlot | null;
  width: number;
  height: number;
  byId: Record<number, LosersPlacedMatch>;
}

interface Meta {
  match: BMMatch;
  bracket: 'winner' | 'loser';
  round: number;
  row: number;
}

function metasOf(data: StageData): Meta[] {
  const groupNumber = new Map(data.group.map((group) => [group.id, group.number]));
  const roundInfo = new Map(
    data.round.map((round) => [round.id, { group: groupNumber.get(round.group_id) ?? 1, round: round.number }]),
  );
  const buckets = new Map<string, BMMatch[]>();
  for (const match of data.match) {
    const info = roundInfo.get(match.round_id);
    if (!info || (info.group !== 1 && info.group !== 2)) continue;
    const key = `${info.group}:${info.round}`;
    const list = buckets.get(key) ?? [];
    list.push(match);
    buckets.set(key, list);
  }
  const metas: Meta[] = [];
  for (const [key, matches] of buckets) {
    const [group, roundText] = key.split(':');
    matches.sort((a, b) => a.number - b.number);
    matches.forEach((match, row) => {
      metas.push({
        match,
        bracket: group === '1' ? 'winner' : 'loser',
        round: Number(roundText),
        row,
      });
    });
  }
  return metas;
}

function lbAdvanceRow(fromRound: number, fromRow: number): number {
  return fromRound % 2 === 1 ? fromRow : Math.floor(fromRow / 2);
}

function findWb(metas: Meta[], loser: Meta, position: number): Meta | null {
  if (loser.round === 1) {
    const row = Math.floor((position - 1) / 2);
    return metas.find((meta) => meta.bracket === 'winner' && meta.round === 1 && meta.row === row) ?? null;
  }
  const round = loser.round % 2 === 0 ? loser.round : loser.round - 1;
  return metas.find((meta) => meta.bracket === 'winner' && meta.round === round && meta.match.number === position) ?? null;
}

function feeders(metas: Meta[], loser: Meta): Meta[] {
  return metas.filter(
    (meta) => meta.bracket === 'loser' && meta.round + 1 === loser.round && lbAdvanceRow(meta.round, meta.row) === loser.row,
  );
}

function sourceOf(metas: Meta[], loser: Meta, slot: 0 | 1, opponent: BMOpponent | null): { source: string; origin: LoserSlotView['origin'] } {
  if (opponent?.position != null) {
    const from = findWb(metas, loser, opponent.position);
    return {
      source: from ? `ウィナーズ ${from.round}回戦の敗者` : 'ウィナーズの敗者',
      origin: 'wb_drop',
    };
  }
  const from = feeders(metas, loser).sort((a, b) => a.match.number - b.match.number);
  const pick = from.length === 1 ? from[0] : from[slot];
  if (pick) return { source: `ルーザーズ ${pick.round}回戦の勝者`, origin: 'lb_advance' };
  return { source: 'ひとつ前の勝者', origin: 'unknown' };
}

function nextIdOf(metas: Meta[], meta: Meta): number | null {
  const row = lbAdvanceRow(meta.round, meta.row);
  const next = metas.find((item) => item.bracket === 'loser' && item.round === meta.round + 1 && item.row === row);
  return next?.match.id ?? null;
}

function statusOf(match: BMMatch): LoserSlotStatus {
  if (match.status >= Status.Completed) return 'done';
  if (match.status === Status.Running) return 'live';
  if (match.status === Status.Ready) return 'ready';
  return 'wait';
}

function teamId(data: StageData, opponent: BMOpponent | null): string | null {
  if (opponent?.id == null) return null;
  return data.participant.find((person) => person.id === opponent.id)?.name ?? null;
}

const UNFED = 'ひとつ前の勝者';

function participantIds(match: BMMatch): number[] {
  return [match.opponent1?.id, match.opponent2?.id].filter((id): id is number => id != null);
}

/** 不戦勝で本人がすでに下へ入っている試合はカードにしない */
function byePlaceholderIds(metas: Meta[]): Set<number> {
  const ids = new Set<number>();
  for (const meta of metas) {
    if (meta.bracket !== 'loser') continue;
    const players = participantIds(meta.match);
    if (players.length !== 1) continue;
    const nextId = nextIdOf(metas, meta);
    if (nextId == null) continue;
    const next = metas.find((item) => item.match.id === nextId);
    if (!next || !participantIds(next.match).includes(players[0])) continue;
    ids.add(meta.match.id);
  }
  return ids;
}

function roundKindOf(round: number, sample: LoserMatchView | undefined): LoserRoundKind {
  if (round === 1) return 'wb_drop_pair';
  const origins = sample?.slots.map((slot) => slot.origin) ?? [];
  if (origins.filter((origin) => origin === 'lb_advance').length >= 2) return 'survivor_merge';
  if (origins.includes('wb_drop') && origins.includes('lb_advance')) return 'survivor_vs_drop';
  // 偶数回戦の直後は合流、奇数回戦の直後は真下＋落ち
  return round % 2 === 1 ? 'survivor_merge' : 'survivor_vs_drop';
}

function wbDropRoundLabel(slots: LoserSlotView[]): number | null {
  for (const slot of slots) {
    const match = slot.source.match(/ウィナーズ (\d+)回戦/);
    if (match) return Number(match[1]);
  }
  return null;
}

/** 段の見出し。初めて見る人が規則を読める一文にする */
export function loserRoundLabel(kind: LoserRoundKind, round: number, slots?: LoserSlotView[]): string {
  if (kind === 'wb_drop_pair') {
    const wb = wbDropRoundLabel(slots ?? []) ?? 1;
    return `ウィナーズ${wb}回戦の敗者同士`;
  }
  if (kind === 'survivor_vs_drop') {
    const wb = wbDropRoundLabel(slots ?? []) ?? round;
    return `上の勝者 対 ウィナーズ${wb}回戦の敗者`;
  }
  return '上の2試合の勝者が対戦';
}

function advanceSlotOf(match: LoserMatchView): 0 | 1 | null {
  const left = match.slots[0].origin === 'lb_advance';
  const right = match.slots[1].origin === 'lb_advance';
  if (left && !right) return 0;
  if (right && !left) return 1;
  return null;
}

/** 対戦相手のいない空枠は列に出さない。人が入る試合だけを残す。 */
export function shownLoserColumns(columns: LoserColumn[]): LoserColumn[] {
  return columns
    .map((column) => ({
      ...column,
      matches: column.matches.filter((match) =>
        match.slots.some((slot) => slot.teamId != null || slot.source !== UNFED),
      ),
    }))
    .filter((column) => column.matches.length > 0);
}

/** ルーザーズの試合を、回戦の列にする。進行の計算はしない。 */
export function losersColumns(data: StageData): LoserColumn[] {
  const metas = metasOf(data);
  const hidden = byePlaceholderIds(metas);
  const losers = metas.filter((meta) => meta.bracket === 'loser' && !hidden.has(meta.match.id));
  const rounds = [...new Set(losers.map((meta) => meta.round))].sort((a, b) => a - b);
  return rounds.map((round) => ({
    round,
    matches: losers
      .filter((meta) => meta.round === round)
      .sort((a, b) => a.row - b.row)
      .map((meta) => ({
        id: meta.match.id,
        round,
        number: meta.match.number,
        status: statusOf(meta.match),
        nextId: nextIdOf(metas, meta),
        slots: [0, 1].map((slot) => {
          const opponent = slot === 0 ? meta.match.opponent1 : meta.match.opponent2;
          const info = sourceOf(metas, meta, slot as 0 | 1, opponent);
          return {
            teamId: teamId(data, opponent),
            source: info.source,
            origin: info.origin,
          };
        }) as [LoserSlotView, LoserSlotView],
      })),
  }));
}

function connectorPath(from: Point, to: Point): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}`;
}

/** 人が入った試合だけを残す。空の説明枠は出さない。 */
function enteredLoserColumns(columns: LoserColumn[]): LoserColumn[] {
  return columns
    .map((column) => ({
      ...column,
      matches: column.matches.filter((match) => match.slots.some((slot) => slot.teamId != null)),
    }))
    .filter((column) => column.matches.length > 0);
}

/** 希望位置を保ったまま、同じ段のカードが重ならないよう右へ送る。 */
function separateXs(desired: Array<{ id: number; x: number }>, step: number): Map<number, number> {
  const ordered = [...desired].sort((a, b) => a.x - b.x || a.id - b.id);
  const xs = new Map<number, number>();
  let cursor = -Infinity;
  for (const item of ordered) {
    const x = Math.max(item.x, cursor);
    xs.set(item.id, x);
    cursor = x + step;
  }
  return xs;
}

/**
 * 全段を上から下へ積む。各カードは左右2枠。
 * 人が確定した枠だけを置き、同じ段では重ねない。
 */
export function computeLosersBoardLayout(
  data: StageData,
  cfg: LosersBoardConfig = DEFAULT_LOSERS_BOARD,
): LosersBoardLayout {
  const columns = enteredLoserColumns(losersColumns(data));
  const byId: Record<number, LosersPlacedMatch> = {};
  const rounds: LosersRoundRow[] = [];
  const connectors: LosersConnector[] = [];

  if (columns.length === 0) {
    return { rounds: [], connectors: [], grandFinal: null, width: cfg.padding * 2, height: cfg.padding * 2, byId };
  }

  const first = columns[0];
  const step = cfg.matchW + cfg.matchGap;
  let y = cfg.padding;

  function placeRow(column: LoserColumn, desired: Array<{ id: number; x: number }>, parents: LoserMatchView[]) {
    const kind = roundKindOf(column.round, column.matches[0]);
    const label = loserRoundLabel(kind, column.round, column.matches[0]?.slots);
    const matchY = y + cfg.headerH;
    const xs = separateXs(desired, step);
    const placed: LosersPlacedMatch[] = column.matches.map((match) => {
      const item: LosersPlacedMatch = {
        ...match,
        x: xs.get(match.id) ?? cfg.padding,
        y: matchY,
        w: cfg.matchW,
        h: cfg.matchH,
        advanceSlot: advanceSlotOf(match),
      };
      byId[match.id] = item;
      return item;
    });
    rounds.push({ round: column.round, kind, label, y, matches: placed });

    for (const parent of parents) {
      if (parent.nextId == null) continue;
      const from = byId[parent.id];
      const to = byId[parent.nextId];
      if (!from || !to) continue;
      const start: Point = { x: from.x + from.w / 2, y: from.y + from.h };
      const end: Point = { x: to.x + to.w / 2, y: to.y };
      connectors.push({
        fromMatchId: parent.id,
        toMatchId: to.id,
        from: start,
        to: end,
        path: connectorPath(start, end),
      });
    }

    y = matchY + cfg.matchH + cfg.roundGap;
  }

  placeRow(
    first,
    first.matches.map((match, index) => ({ id: match.id, x: cfg.padding + index * step })),
    [],
  );

  for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex];
    const parents = columns[columnIndex - 1].matches;
    const desired = column.matches.map((match, index) => {
      const feedersFor = parents.filter((parent) => parent.nextId === match.id);
      if (feedersFor.length >= 2) {
        const parentXs = feedersFor.map((parent) => byId[parent.id]?.x ?? cfg.padding);
        return { id: match.id, x: (Math.min(...parentXs) + Math.max(...parentXs)) / 2 };
      }
      if (feedersFor.length === 1) {
        return { id: match.id, x: byId[feedersFor[0].id]?.x ?? cfg.padding };
      }
      return { id: match.id, x: cfg.padding + index * step };
    });
    placeRow(column, desired, parents);
  }

  const lastRound = rounds[rounds.length - 1];
  const lastMatch = lastRound?.matches[0] ?? null;
  let grandFinal: LosersGrandFinalSlot | null = null;
  if (lastMatch && lastRound.matches.length === 1) {
    const gfY = y + 8;
    grandFinal = {
      x: lastMatch.x + (lastMatch.w - cfg.matchW) / 2,
      y: gfY,
      w: cfg.matchW,
      h: cfg.gfH,
      fromMatchId: lastMatch.id,
    };
    const start: Point = { x: lastMatch.x + lastMatch.w / 2, y: lastMatch.y + lastMatch.h };
    const end: Point = { x: grandFinal.x + grandFinal.w / 2, y: grandFinal.y };
    connectors.push({
      fromMatchId: lastMatch.id,
      toMatchId: -1,
      from: start,
      to: end,
      path: connectorPath(start, end),
    });
    y = gfY + cfg.gfH + cfg.padding;
  } else {
    y += cfg.padding - cfg.roundGap;
  }

  const right = Math.max(
    cfg.padding,
    ...rounds.flatMap((round) => round.matches.map((match) => match.x + match.w)),
    grandFinal ? grandFinal.x + grandFinal.w : 0,
  );
  return {
    rounds,
    connectors,
    grandFinal,
    width: right + cfg.padding,
    height: Math.max(y, cfg.padding * 2),
    byId,
  };
}

/** 勝者が下の枠へ進む線。グランドファイナル枠は toMatchId = -1 */
export function resolveLosersAdvancePath(
  layout: LosersBoardLayout,
  matchId: number,
): { fromMatchId: number; toMatchId: number; path: string; source: Point; target: Point } | null {
  const link = layout.connectors.find((connector) => connector.fromMatchId === matchId);
  if (!link) return null;
  return {
    fromMatchId: link.fromMatchId,
    toMatchId: link.toMatchId,
    path: link.path,
    source: link.from,
    target: link.to,
  };
}
