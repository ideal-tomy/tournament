import { Status } from 'brackets-model';

export interface BMGroup { id: number; number: number; stage_id: number }
export interface BMRound { id: number; number: number; group_id: number; stage_id: number }
export interface BMOpponent {
  id: number | null;
  position?: number;
  score?: number;
  result?: 'win' | 'loss' | 'draw';
}
export interface BMMatch {
  id: number;
  number: number;
  group_id: number;
  round_id: number;
  status: number;
  opponent1: BMOpponent | null;
  opponent2: BMOpponent | null;
}
export interface BMParticipant { id: number; tournament_id: number; name: string }
export interface StageData {
  group: BMGroup[];
  round: BMRound[];
  match: BMMatch[];
  participant: BMParticipant[];
}

export type BracketKind = 'winner' | 'loser' | 'grand_final';
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface SlotLayout {
  slot: 0 | 1;
  teamRef: number | null;
  rect: Rect;
  center: Point;
}
export interface MatchLayout {
  matchId: number;
  bracket: BracketKind;
  round: number;
  col: number;
  row: number;
  box: Rect;
  center: Point;
  slots: [SlotLayout, SlotLayout];
  /** 最下段（フル表示: 顔+名前） */
  isLeafRound: boolean;
}
export interface Connector {
  fromMatchId: number;
  toMatchId: number;
  kind: 'advance' | 'drop';
  from: Point;
  to: Point;
}
export interface BracketLayout {
  matches: MatchLayout[];
  connectors: Connector[];
  width: number;
  height: number;
  byId: Record<number, MatchLayout>;
}

export interface LayoutConfig {
  boxW: number;
  boxH: number;
  /** 2 回戦以降（顔のみ） */
  compactBoxW: number;
  compactBoxH: number;
  roundGap: number;
  matchGap: number;
  sectionGap: number;
  padding: number;
}
export const DEFAULT_LAYOUT: LayoutConfig = {
  boxW: 56,
  boxH: 72,
  compactBoxW: 28,
  compactBoxH: 26,
  roundGap: 26,
  matchGap: 6,
  sectionGap: 28,
  padding: 36,
};

interface MatchMeta {
  match: BMMatch;
  bracket: BracketKind;
  round: number;
  row: number;
  groupNumber: number;
}

function kindOf(groupNumber: number): BracketKind {
  if (groupNumber === 1) return 'winner';
  if (groupNumber === 2) return 'loser';
  return 'grand_final';
}

function buildMatchMetas(data: StageData): MatchMeta[] {
  const groupNumberById = new Map(data.group.map((g) => [g.id, g.number]));
  const roundInfoById = new Map(
    data.round.map((r) => [
      r.id,
      { groupNumber: groupNumberById.get(r.group_id) ?? 1, roundNumber: r.number },
    ]),
  );

  type Bucket = { bracket: BracketKind; round: number; matches: BMMatch[] };
  const buckets = new Map<string, Bucket>();
  for (const m of data.match) {
    const info = roundInfoById.get(m.round_id);
    if (!info) continue;
    const bracket = kindOf(info.groupNumber);
    const key = `${bracket}:${info.roundNumber}`;
    if (!buckets.has(key)) buckets.set(key, { bracket, round: info.roundNumber, matches: [] });
    buckets.get(key)!.matches.push(m);
  }
  for (const b of buckets.values()) b.matches.sort((a, z) => a.number - z.number);

  const metas: MatchMeta[] = [];
  for (const b of buckets.values()) {
    b.matches.forEach((m, row) => {
      const info = roundInfoById.get(m.round_id)!;
      metas.push({
        match: m,
        bracket: b.bracket,
        round: b.round,
        row,
        groupNumber: info.groupNumber,
      });
    });
  }
  return metas;
}

/** WB 勝者: 次ラウンド row */
function wbAdvanceRow(fromRow: number): number {
  return Math.floor(fromRow / 2);
}

/** LB 勝者: major→minor は同 row、minor→major は半分 */
function lbAdvanceRow(fromRound: number, fromRow: number): number {
  return fromRound % 2 === 1 ? fromRow : Math.floor(fromRow / 2);
}

function findMeta(
  metas: MatchMeta[],
  bracket: BracketKind,
  round: number,
  row: number,
): MatchMeta | null {
  return metas.find((m) => m.bracket === bracket && m.round === round && m.row === row) ?? null;
}

function lastMeta(metas: MatchMeta[], bracket: BracketKind): MatchMeta | null {
  const filtered = metas.filter((m) => m.bracket === bracket);
  if (!filtered.length) return null;
  return filtered.reduce((a, b) => (a.round > b.round || (a.round === b.round && a.row < b.row) ? a : b));
}

function buildAdvanceConnectors(metas: MatchMeta[]): Array<{ from: number; to: number }> {
  const links: Array<{ from: number; to: number }> = [];
  const seen = new Set<string>();

  function add(from: MatchMeta, to: MatchMeta) {
    const key = `${from.match.id}->${to.match.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ from: from.match.id, to: to.match.id });
  }

  for (const m of metas) {
    if (m.bracket === 'winner') {
      const next = findMeta(metas, 'winner', m.round + 1, wbAdvanceRow(m.row));
      if (next) add(m, next);
    } else if (m.bracket === 'loser') {
      const next = findMeta(metas, 'loser', m.round + 1, lbAdvanceRow(m.round, m.row));
      if (next) add(m, next);
    } else if (m.bracket === 'grand_final') {
      const next = findMeta(metas, 'grand_final', m.round + 1, 0);
      if (next) add(m, next);
    }
  }

  const wbFinal = lastMeta(metas, 'winner');
  const lbFinal = lastMeta(metas, 'loser');
  const gfFirst = findMeta(metas, 'grand_final', 1, 0);
  if (wbFinal && gfFirst) add(wbFinal, gfFirst);
  if (lbFinal && gfFirst) add(lbFinal, gfFirst);

  return links;
}

function buildDropConnectors(metas: MatchMeta[]): Array<{ from: number; to: number }> {
  const links: Array<{ from: number; to: number }> = [];
  const seen = new Set<string>();

  for (const lb of metas.filter((m) => m.bracket === 'loser')) {
    for (const opp of [lb.match.opponent1, lb.match.opponent2]) {
      if (opp?.position == null) continue;
      const wb = findWbFeeder(metas, lb, opp.position);
      if (!wb) continue;
      const key = `${wb.match.id}->${lb.match.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ from: wb.match.id, to: lb.match.id });
    }
  }

  return links;
}

function findWbFeeder(metas: MatchMeta[], lb: MatchMeta, position: number): MatchMeta | null {
  if (lb.round === 1) {
    const row = Math.floor((position - 1) / 2);
    return findMeta(metas, 'winner', 1, row);
  }
  const wbRound = lb.round % 2 === 0 ? lb.round : lb.round - 1;
  const wb = metas.find(
    (m) => m.bracket === 'winner' && m.round === wbRound && m.match.number === position,
  );
  return wb ?? null;
}

function isSlotFilled(op: BMOpponent | null | undefined): boolean {
  return op?.id != null;
}

function hasEntrant(meta: MatchMeta): boolean {
  return meta.match.opponent1?.id != null || meta.match.opponent2?.id != null;
}

/** ウィナーズは空枠も含めて表示。ルーザーズは誰か入った試合だけ。GF は参加者が入った試合のみ。 */
export function isMatchVisibleForDisplay(meta: MatchMeta): boolean {
  if (meta.bracket === 'winner' || meta.bracket === 'loser') return true;
  return isSlotFilled(meta.match.opponent1) || isSlotFilled(meta.match.opponent2);
}

export function filterVisibleMetas(metas: MatchMeta[]): MatchMeta[] {
  return metas.filter(isMatchVisibleForDisplay);
}

function connectorPoints(
  from: MatchLayout,
  to: MatchLayout,
  kind: 'advance' | 'drop',
): { from: Point; to: Point } {
  if (kind === 'drop') {
    return {
      from: { x: from.center.x, y: from.box.y + from.box.h },
      to: { x: to.center.x, y: to.box.y },
    };
  }
  // 行き先が下（ルーザーズ）なら下辺から出て上辺へ。ウィナーズは上へ伸びる。
  if (to.box.y >= from.box.y + from.box.h - 0.01) {
    return {
      from: { x: from.center.x, y: from.box.y + from.box.h },
      to: { x: to.center.x, y: to.box.y },
    };
  }
  return {
    from: { x: from.center.x, y: from.box.y },
    to: { x: to.center.x, y: to.box.y + to.box.h },
  };
}

/** トーナメント表の直角コネクタ（縦→横→縦）。midY は sibling 共通の接合高さ */
export function buildOrthogonalConnectorPath(from: Point, to: Point, midY?: number): string {
  const y = midY ?? (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} V ${y} H ${to.x} V ${to.y}`;
}

function feedersForAdvance(
  meta: MatchMeta,
  allMetas: MatchMeta[],
): MatchMeta[] {
  if (meta.bracket === 'winner') {
    const r = meta.round - 1;
    if (r < 1) return [];
    return [
      findMeta(allMetas, 'winner', r, meta.row * 2),
      findMeta(allMetas, 'winner', r, meta.row * 2 + 1),
    ].filter((m): m is MatchMeta => m != null);
  }
  if (meta.bracket === 'loser') {
    return allMetas.filter((m) => {
      if (m.bracket !== 'loser') return false;
      const next = findMeta(allMetas, 'loser', m.round + 1, lbAdvanceRow(m.round, m.row));
      return next?.match.id === meta.match.id;
    });
  }
  if (meta.bracket === 'grand_final' && meta.round === 1) {
    const wbFinal = lastMeta(allMetas, 'winner');
    const lbFinal = lastMeta(allMetas, 'loser');
    return [wbFinal, lbFinal].filter((m): m is MatchMeta => m != null);
  }
  return allMetas.filter((m) => {
    if (m.bracket !== 'grand_final') return false;
    const next = findMeta(allMetas, 'grand_final', m.round + 1, 0);
    return next?.match.id === meta.match.id;
  });
}

function computeCenterXMap(
  items: MatchMeta[],
  allMetas: MatchMeta[],
  cfg: LayoutConfig,
  offsetX: number,
  /** 行番号の空きを詰め、見えている試合を左から並べる（ルーザーズ） */
  packLeaves = false,
): Map<number, number> {
  const centerXByMatchId = new Map<number, number>();
  if (items.length === 0) return centerXByMatchId;

  const minRound = Math.min(...items.map((m) => m.round));
  const byRound = groupByRound(items);
  const leafItems = [...(byRound.find((b) => b.round === minRound)?.items ?? [])].sort(
    (a, b) => a.row - b.row || a.match.number - b.match.number,
  );
  const leafStep = cfg.boxW + cfg.matchGap;

  leafItems.forEach((meta, index) => {
    const slot = packLeaves ? index : meta.row;
    centerXByMatchId.set(meta.match.id, offsetX + slot * leafStep + cfg.boxW / 2);
  });

  const maxRound = Math.max(...items.map((m) => m.round));
  for (let round = minRound + 1; round <= maxRound; round++) {
    const roundItems = [...(byRound.find((b) => b.round === round)?.items ?? [])].sort(
      (a, b) => a.row - b.row || a.match.number - b.match.number,
    );
    roundItems.forEach((meta, index) => {
      const feeders = feedersForAdvance(meta, allMetas).filter((f) =>
        items.some((i) => i.match.id === f.match.id),
      );
      const xs = feeders
        .map((f) => centerXByMatchId.get(f.match.id))
        .filter((x): x is number => x != null);

      let cx: number;
      if (xs.length >= 2) {
        cx = (xs[0] + xs[1]) / 2;
      } else if (xs.length === 1) {
        cx = xs[0];
      } else if (packLeaves) {
        cx = offsetX + index * leafStep + cfg.boxW / 2;
      } else {
        cx = offsetX + meta.row * leafStep + cfg.boxW / 2;
      }
      centerXByMatchId.set(meta.match.id, cx);
    });
  }

  return centerXByMatchId;
}

function buildMatchLayout(
  meta: MatchMeta,
  cx: number,
  boxY: number,
  cfg: LayoutConfig,
  isLeafRound: boolean,
): MatchLayout {
  const boxW = isLeafRound ? cfg.boxW : cfg.compactBoxW;
  const boxH = isLeafRound ? cfg.boxH : cfg.compactBoxH;
  const boxX = cx - boxW / 2;
  const box: Rect = { x: boxX, y: boxY, w: boxW, h: boxH };
  const slotW = boxW / 2;
  const mkSlot = (slot: 0 | 1, op: BMOpponent | null): SlotLayout => {
    const rect: Rect = { x: boxX + slot * slotW, y: boxY, w: slotW, h: boxH };
    return {
      slot,
      teamRef: op?.id ?? null,
      rect,
      center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    };
  };
  return {
    matchId: meta.match.id,
    bracket: meta.bracket,
    round: meta.round,
    col: meta.round - 1,
    row: meta.row,
    box,
    center: { x: cx, y: box.y + box.h / 2 },
    slots: [mkSlot(0, meta.match.opponent1), mkSlot(1, meta.match.opponent2)],
    isLeafRound,
  };
}

function participantIds(match: BMMatch): number[] {
  return [match.opponent1?.id, match.opponent2?.id].filter((id): id is number => id != null);
}

function parentMeta(meta: MatchMeta, metas: MatchMeta[]): MatchMeta | null {
  if (meta.bracket === 'winner') return findMeta(metas, 'winner', meta.round + 1, wbAdvanceRow(meta.row));
  if (meta.bracket === 'loser') return findMeta(metas, 'loser', meta.round + 1, lbAdvanceRow(meta.round, meta.row));
  if (meta.bracket === 'grand_final') return findMeta(metas, 'grand_final', meta.round + 1, 0);
  return null;
}

/** 相手のいない枠で、本人はすでに次の試合へ入っている。カードにはしない。 */
function byePlaceholderIds(metas: MatchMeta[]): Set<number> {
  const ids = new Set<number>();
  for (const meta of metas) {
    const players = participantIds(meta.match);
    if (players.length !== 1) continue;
    const parent = parentMeta(meta, metas);
    if (!parent || !participantIds(parent.match).includes(players[0])) continue;
    ids.add(meta.match.id);
  }
  return ids;
}

/** 表示する最初の対戦。不戦勝同士の試合も、1回戦と同じ一番下の段に置く。 */
function baselineMatchIds(metas: MatchMeta[], hidden: Set<number>): Set<number> {
  const ids = new Set<number>();
  for (const meta of metas) {
    if (hidden.has(meta.match.id)) continue;
    const feeders = feedersForAdvance(meta, metas);
    if (feeders.length === 0 || feeders.every((feeder) => hidden.has(feeder.match.id))) ids.add(meta.match.id);
  }
  return ids;
}

type TreeGrowth = 'up' | 'down';

function placeTreeSection(
  items: MatchMeta[],
  allMetas: MatchMeta[],
  cfg: LayoutConfig,
  baseEdge: number,
  roundOffset: (round: number) => number,
  offsetX: number,
  hidden: Set<number>,
  baseline: Set<number>,
  growth: TreeGrowth = 'up',
  packLeaves = false,
): MatchLayout[] {
  if (items.length === 0) return [];

  const minRound = Math.min(...items.map((m) => m.round));
  const maxRound = Math.max(...items.map((m) => m.round));
  const centerXByMatchId = computeCenterXMap(items, allMetas, cfg, offsetX, packLeaves);
  const boxHFor = (round: number) => (round === minRound ? cfg.boxH : cfg.compactBoxH);
  const layouts: MatchLayout[] = [];

  if (growth === 'down') {
    // ルーザーズ: 初戦を上端に置き、回戦が進むほど下へ積む。
    const tierTopAt = new Map<number, number>();
    let tierTop = baseEdge + (roundOffset(minRound) - minRound) * (cfg.boxH + cfg.roundGap);
    for (let round = minRound; round <= maxRound; round += 1) {
      tierTopAt.set(roundOffset(round), tierTop);
      tierTop += boxHFor(round) + cfg.roundGap;
    }
    for (const meta of items) {
      if (hidden.has(meta.match.id)) continue;
      const cx = centerXByMatchId.get(meta.match.id);
      if (cx == null) continue;
      const isLeaf = meta.round === minRound;
      const boxY = tierTopAt.get(roundOffset(meta.round)) ?? baseEdge;
      layouts.push(buildMatchLayout(meta, cx, boxY, cfg, isLeaf));
    }
    return layouts;
  }

  const tierBottomAt = new Map<number, number>();
  let tierBottom = baseEdge - (roundOffset(minRound) - minRound) * (cfg.boxH + cfg.roundGap);
  for (let round = minRound; round <= maxRound; round += 1) {
    tierBottomAt.set(roundOffset(round), tierBottom);
    tierBottom -= boxHFor(round) + cfg.roundGap;
  }

  for (const meta of items) {
    if (hidden.has(meta.match.id)) continue;
    const cx = centerXByMatchId.get(meta.match.id);
    if (cx == null) continue;
    const onBaseline = baseline.has(meta.match.id);
    const isLeaf = onBaseline || meta.round === minRound;
    const tierRound = onBaseline ? minRound : meta.round;
    const boxH = isLeaf ? cfg.boxH : boxHFor(meta.round);
    const bottom = tierBottomAt.get(roundOffset(tierRound)) ?? baseEdge;
    const boxY = bottom - boxH;
    layouts.push(buildMatchLayout(meta, cx, boxY, cfg, isLeaf));
  }

  return layouts;
}

export type BracketBoardSide = 'winners' | 'losers' | 'grand_final' | 'all';

export interface BracketLayoutFocus {
  /** 終了試合を除外したあとの残りだけで座標を組み直す（カメラ寄せ） */
  visibleMatchIds?: Set<number>;
  /** この回戦を大きいカードにし、初戦と同じ画面幅の中央へ置く。ウィナーズは下端、ルーザーズは上端 */
  leafRound?: number;
  /** ウィナーズ／ルーザーズの決勝からグランドファイナルへつなぐ。行き先の枠を同じ盤に足す */
  attachGrandFinal?: boolean;
}

/** 勝ち上がり演出が描く盤。回戦では切らず、表全体を同じ座標にする。 */
export function fullBoardFocus(attachGrandFinal: boolean): BracketLayoutFocus | undefined {
  return attachGrandFinal ? { attachGrandFinal: true } : undefined;
}

/** まだ終わっていない一番下の回戦。全部終わっていれば最終回戦。 */
export function activeLeafRound(data: StageData, bracket: BracketKind = 'winner'): number {
  const rounds = new Map<number, BMMatch[]>();
  for (const meta of buildMatchMetas(data)) {
    if (meta.bracket !== bracket) continue;
    // ルーザーズは人が入った試合だけを進行の段にする。
    if (bracket === 'loser' && !hasEntrant(meta)) continue;
    const list = rounds.get(meta.round) ?? [];
    list.push(meta.match);
    rounds.set(meta.round, list);
  }
  const ordered = [...rounds.keys()].sort((a, b) => a - b);
  for (const round of ordered) {
    if ((rounds.get(round) ?? []).some((match) => match.status < Status.Completed)) return round;
  }
  return ordered[ordered.length - 1] ?? 1;
}

export function visibleMatchIdsWhenOmitCompleted(
  data: StageData,
  boardSide: BracketBoardSide,
  retainMatchIds: number[] = [],
): Set<number> {
  const retain = new Set(retainMatchIds);
  const full = computeBracketLayout(data, DEFAULT_LAYOUT, boardSide);
  return new Set(
    full.matches
      .filter((m) => {
        const bm = data.match.find((row) => row.id === m.matchId);
        if (bm == null || bm.status < Status.Completed) return true;
        return retain.has(m.matchId);
      })
      .map((m) => m.matchId),
  );
}

function translateMatch(match: MatchLayout, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return;
  match.box = { ...match.box, x: match.box.x + dx, y: match.box.y + dy };
  match.center = { x: match.center.x + dx, y: match.center.y + dy };
  const moveSlot = (slot: SlotLayout): SlotLayout => ({
    ...slot,
    rect: { ...slot.rect, x: slot.rect.x + dx, y: slot.rect.y + dy },
    center: { x: slot.center.x + dx, y: slot.center.y + dy },
  });
  match.slots = [moveSlot(match.slots[0]), moveSlot(match.slots[1])];
}

export function computeBracketLayout(
  data: StageData,
  cfg: LayoutConfig = DEFAULT_LAYOUT,
  boardSide: BracketBoardSide = 'all',
  focus?: BracketLayoutFocus,
): BracketLayout {
  const allMetas = buildMatchMetas(data);
  const visibleIds = new Set(filterVisibleMetas(allMetas).map((m) => m.match.id));
  const metas = allMetas;
  const focusSet = focus?.visibleMatchIds;
  const inFocus = (id: number) => focusSet == null || focusSet.has(id);
  const showWb = boardSide === 'all' || boardSide === 'winners';
  const showLb = boardSide === 'all' || boardSide === 'losers';
  const showGf = boardSide === 'all' || boardSide === 'grand_final' || Boolean(focus?.attachGrandFinal);
  const leafRound = focus?.leafRound;
  // ルーザーズ単独は今の回戦と次の1列。空枠も残して詰める。
  const packLosers = boardSide === 'losers';
  const losersFrame =
    packLosers && leafRound != null
      ? { min: leafRound, max: leafRound + 1 }
      : null;
  const wbMetas = showWb
    ? metas.filter((m) => m.bracket === 'winner' && inFocus(m.match.id))
    : [];
  const lbMetas = showLb
    ? metas.filter((m) => {
        if (m.bracket !== 'loser' || !visibleIds.has(m.match.id) || !inFocus(m.match.id)) return false;
        if (losersFrame) {
          return m.round >= losersFrame.min && m.round <= losersFrame.max;
        }
        return hasEntrant(m);
      })
    : [];
  const gfMetas = showGf
    ? metas.filter((m) => m.bracket === 'grand_final' && visibleIds.has(m.match.id) && inFocus(m.match.id))
    : [];

  const wbMaxRound = wbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const lbMaxRound = lbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const gfMaxRound = gfMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const maxRound = Math.max(wbMaxRound, lbMaxRound, gfMaxRound, 1);

  const wbRound1 = wbMetas.filter((m) => m.round === 1);
  const wbLeafCount =
    wbRound1.length > 0
      ? wbRound1.length
      : wbMetas.length > 0
        ? Math.max(...groupByRound(wbMetas).map((g) => g.items.length), 1)
        : 1;
  const lbLeafCount =
    lbMetas.length > 0
      ? Math.max(...groupByRound(lbMetas).map((g) => g.items.length), 1)
      : 0;

  const wbWidth = showWb ? wbLeafCount * cfg.boxW + (wbLeafCount - 1) * cfg.matchGap : 0;
  const lbWidth =
    lbLeafCount > 0 ? lbLeafCount * cfg.boxW + (lbLeafCount - 1) * cfg.matchGap : 0;
  const wbLeft = cfg.padding;
  const lbLeft = showWb
    ? wbLeft + wbWidth + (lbWidth > 0 ? cfg.sectionGap : 0)
    : cfg.padding;
  const stageForLeaf =
    leafRound != null && leafRound > 1 && showWb
      ? computeBracketLayout(data, cfg, boardSide)
      : null;
  const stage = stageForLeaf;
  let placedWb = wbMetas;
  let placedLb = lbMetas;
  let wbOffset = wbLeft;
  let lbOffset = lbLeft;
  if (stage && leafRound != null && showWb) {
    placedWb = wbMetas.filter((meta) => meta.round >= leafRound);
    const leafItems = placedWb.filter((meta) => meta.round === leafRound);
    const rows = leafItems.map((meta) => meta.row);
    const minRow = rows.length ? Math.min(...rows) : 0;
    const maxRow = rows.length ? Math.max(...rows) : 0;
    const span = (maxRow - minRow) * (cfg.boxW + cfg.matchGap) + cfg.boxW;
    wbOffset = (stage.width - span) / 2 - minRow * (cfg.boxW + cfg.matchGap);
  }
  if (packLosers && leafRound != null) {
    placedLb = lbMetas;
    const leafItems = [...placedLb.filter((meta) => meta.round === leafRound)].sort(
      (a, b) => a.row - b.row || a.match.number - b.match.number,
    );
    const span =
      leafItems.length > 0
        ? leafItems.length * cfg.boxW + (leafItems.length - 1) * cfg.matchGap
        : cfg.boxW;
    const boardWidth = Math.max(lbLeft + span + cfg.padding, lbLeft + lbWidth + cfg.padding);
    lbOffset = Math.max(cfg.padding, (boardWidth - span) / 2);
  }

  const baseBottom =
    cfg.padding + (maxRound + gfMaxRound + 1) * (cfg.boxH + cfg.roundGap);
  const baseTop = cfg.padding;
  const hidden = byePlaceholderIds(metas);
  const baselineScope = focusSet ? metas.filter((m) => inFocus(m.match.id)) : metas;
  // 下段揃えはウィナーズの不戦勝用。ルーザーズの途中枠を初戦の段へ下ろさない。
  const baseline = baselineMatchIds(baselineScope.filter((m) => m.bracket !== 'loser'), hidden);

  // 会場のルーザーズ単独表示だけ下向き。WB+LB 同居（all）は従来どおり同じ下端から上へ。
  const lbGrowth: TreeGrowth = boardSide === 'losers' ? 'down' : 'up';
  const lbEdge = lbGrowth === 'down' ? baseTop : baseBottom;
  const matches: MatchLayout[] = [
    ...placeTreeSection(placedWb, metas, cfg, baseBottom, (r) => r, wbOffset, hidden, baseline, 'up'),
    ...placeTreeSection(placedLb, metas, cfg, lbEdge, (r) => r, lbOffset, hidden, baseline, lbGrowth, packLosers),
    ...placeTreeSection(gfMetas, metas, cfg, baseBottom, (r) => maxRound + r, wbLeft, hidden, baseline, 'up'),
  ];

  if (focus?.attachGrandFinal && (boardSide === 'winners' || boardSide === 'losers')) {
    const feederBracket = boardSide === 'losers' ? 'loser' : 'winner';
    const source = matches
      .filter((match) => match.bracket === feederBracket)
      .reduce<MatchLayout | null>((best, match) => (!best || match.round > best.round ? match : best), null);
    const grandFinal = matches.find((match) => match.bracket === 'grand_final' && match.round === 1);
    if (source && grandFinal) {
      const dx = source.center.x - grandFinal.center.x;
      const dy = boardSide === 'losers'
        ? source.box.y + source.box.h + cfg.roundGap - grandFinal.box.y
        : source.box.y - cfg.roundGap - grandFinal.box.h - grandFinal.box.y;
      translateMatch(grandFinal, dx, dy);
    }
  }

  const byId: Record<number, MatchLayout> = {};
  for (const m of matches) byId[m.matchId] = m;

  const connectors: Connector[] = [];
  for (const link of buildAdvanceConnectors(metas)) {
    if (!inFocus(link.from) || !inFocus(link.to)) continue;
    if (!visibleIds.has(link.from) || !visibleIds.has(link.to)) continue;
    const from = byId[link.from];
    const to = byId[link.to];
    if (!from || !to) continue;
    const pts = connectorPoints(from, to, 'advance');
    connectors.push({
      fromMatchId: link.from,
      toMatchId: link.to,
      kind: 'advance',
      ...pts,
    });
  }
  for (const link of buildDropConnectors(metas)) {
    if (!inFocus(link.from) || !inFocus(link.to)) continue;
    if (!visibleIds.has(link.from) || !visibleIds.has(link.to)) continue;
    const source = data.match.find((m) => m.id === link.from);
    if (!source || source.status < Status.Completed) continue;
    const from = byId[link.from];
    const to = byId[link.to];
    if (!from || !to) continue;
    const pts = connectorPoints(from, to, 'drop');
    connectors.push({
      fromMatchId: link.from,
      toMatchId: link.to,
      kind: 'drop',
      ...pts,
    });
  }


  const maxRight = matches.reduce((mx, m) => Math.max(mx, m.box.x + m.box.w), 0);
  const minTop = matches.reduce((mn, m) => Math.min(mn, m.box.y), baseBottom);
  const maxBottom = matches.reduce((mx, m) => Math.max(mx, m.box.y + m.box.h), baseBottom);
  const framedHeight = stage ? Math.max(stage.height, maxBottom - minTop + cfg.padding * 2) : 0;
  const yShift = stage ? (minTop + maxBottom) / 2 - framedHeight / 2 : minTop - cfg.padding;

  if (yShift !== 0) {
    for (const m of matches) {
      m.box.y -= yShift;
      m.center.y -= yShift;
      for (const s of m.slots) {
        s.rect.y -= yShift;
        s.center.y -= yShift;
      }
    }
    for (const c of connectors) {
      c.from.y -= yShift;
      c.to.y -= yShift;
    }
  }

  if (stage) return { matches, connectors, width: stage.width, height: framedHeight, byId };

  const width = maxRight + cfg.padding;
  const height = maxBottom - minTop + cfg.padding * 2;

  return { matches, connectors, width, height, byId };
}

function groupByRound(metas: MatchMeta[]): { round: number; items: MatchMeta[] }[] {
  const map = new Map<number, MatchMeta[]>();
  for (const m of metas) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, items]) => ({ round, items }));
}

export function getWinnerParticipantId(m: BMMatch): number | null {
  if (m.opponent1?.result === 'win' && m.opponent1.id != null) return m.opponent1.id as number;
  if (m.opponent2?.result === 'win' && m.opponent2.id != null) return m.opponent2.id as number;
  return null;
}

export function getLoserParticipantId(m: BMMatch): number | null {
  if (m.opponent1?.result === 'loss' && m.opponent1.id != null) return m.opponent1.id as number;
  if (m.opponent2?.result === 'loss' && m.opponent2.id != null) return m.opponent2.id as number;
  return null;
}

/** 枠の中身。確定した人は出し、相手だけが未定の側は待ちと分かるようにする。 */
export function slotPresence(match: BMMatch, slot: 0 | 1): 'team' | 'waiting' | 'empty' {
  const mine = slot === 0 ? match.opponent1 : match.opponent2;
  const other = slot === 0 ? match.opponent2 : match.opponent1;
  if (mine?.id != null) return 'team';
  if (other?.id != null) return 'waiting';
  return 'empty';
}

export function isConnectorHighlighted(connector: Connector, data: StageData): boolean {
  const from = data.match.find((m) => m.id === connector.fromMatchId);
  const to = data.match.find((m) => m.id === connector.toMatchId);
  if (!from || !to || from.status < Status.Completed) return false;
  if (from.opponent1?.id == null || from.opponent2?.id == null) return false;

  const participantInTo = (id: number | null) =>
    id != null && (to.opponent1?.id === id || to.opponent2?.id === id);

  if (connector.kind === 'advance') {
    return participantInTo(getWinnerParticipantId(from));
  }
  return participantInTo(getLoserParticipantId(from));
}

export function resolveTeamId(
  teamRef: number | null,
  participants: BMParticipant[],
): string | null {
  if (teamRef == null) return null;
  const p = participants.find((pp) => pp.id === teamRef);
  return p ? p.name : null;
}

/** 勝ち上がり先（親）試合。存在しなければ null（決勝など） */
export function findParentMatch(data: StageData, matchId: number): BMMatch | null {
  const metas = buildMatchMetas(data);
  const child = metas.find((m) => m.match.id === matchId);
  if (!child) return null;

  if (child.bracket === 'winner') {
    const parent = findMeta(metas, 'winner', child.round + 1, wbAdvanceRow(child.row));
    return parent?.match ?? null;
  }
  if (child.bracket === 'loser') {
    const parent = findMeta(
      metas,
      'loser',
      child.round + 1,
      lbAdvanceRow(child.round, child.row),
    );
    return parent?.match ?? null;
  }
  if (child.bracket === 'grand_final') {
    const parent = findMeta(metas, 'grand_final', child.round + 1, 0);
    return parent?.match ?? null;
  }
  return null;
}

/** 親試合へ進む下位試合（フィーダー）一覧 */
export function findFeederMatches(data: StageData, parentMatchId: number): BMMatch[] {
  const metas = buildMatchMetas(data);
  const parent = metas.find((m) => m.match.id === parentMatchId);
  if (!parent) return [];
  return feedersForAdvance(parent, metas).map((f) => f.match);
}

export function isMatchCompleted(m: BMMatch): boolean {
  return m.status >= Status.Completed;
}
