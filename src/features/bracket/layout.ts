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

/** Losers / GF は参加者が入った試合のみ表示（WB は全ラウンド表示） */
export function isMatchVisibleForDisplay(meta: MatchMeta): boolean {
  if (meta.bracket === 'winner') return true;
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
): Map<number, number> {
  const centerXByMatchId = new Map<number, number>();
  if (items.length === 0) return centerXByMatchId;

  const minRound = Math.min(...items.map((m) => m.round));
  const byRound = groupByRound(items);
  const leafItems = byRound.find((b) => b.round === minRound)?.items ?? [];
  const leafStep = cfg.boxW + cfg.matchGap;

  for (const meta of leafItems) {
    centerXByMatchId.set(meta.match.id, offsetX + meta.row * leafStep + cfg.boxW / 2);
  }

  const maxRound = Math.max(...items.map((m) => m.round));
  for (let round = minRound + 1; round <= maxRound; round++) {
    const roundItems = byRound.find((b) => b.round === round)?.items ?? [];
    for (const meta of roundItems) {
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
      } else {
        cx = offsetX + meta.row * leafStep + cfg.boxW / 2;
      }
      centerXByMatchId.set(meta.match.id, cx);
    }
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

function placeTreeSection(
  items: MatchMeta[],
  allMetas: MatchMeta[],
  cfg: LayoutConfig,
  baseBottom: number,
  roundOffset: (round: number) => number,
  offsetX: number,
): MatchLayout[] {
  if (items.length === 0) return [];

  const minRound = Math.min(...items.map((m) => m.round));
  const centerXByMatchId = computeCenterXMap(items, allMetas, cfg, offsetX);
  const tierStep = cfg.boxH + cfg.roundGap;
  const layouts: MatchLayout[] = [];

  for (const meta of items) {
    const cx = centerXByMatchId.get(meta.match.id);
    if (cx == null) continue;
    const isLeaf = meta.round === minRound;
    const tierBottom = baseBottom - (roundOffset(meta.round) - 1) * tierStep;
    const boxH = isLeaf ? cfg.boxH : cfg.compactBoxH;
    const boxY = tierBottom - boxH;
    layouts.push(buildMatchLayout(meta, cx, boxY, cfg, isLeaf));
  }

  return layouts;
}

export function computeBracketLayout(
  data: StageData,
  cfg: LayoutConfig = DEFAULT_LAYOUT,
): BracketLayout {
  const allMetas = buildMatchMetas(data);
  const visibleIds = new Set(filterVisibleMetas(allMetas).map((m) => m.match.id));
  const metas = allMetas;
  const wbMetas = metas.filter((m) => m.bracket === 'winner');
  const lbMetas = metas.filter((m) => m.bracket === 'loser' && visibleIds.has(m.match.id));
  const gfMetas = metas.filter(
    (m) => m.bracket === 'grand_final' && visibleIds.has(m.match.id),
  );

  const wbMaxRound = wbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const lbMaxRound = lbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const gfMaxRound = gfMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const maxRound = Math.max(wbMaxRound, lbMaxRound, gfMaxRound, 1);

  const wbLeafCount = wbMetas.filter((m) => m.round === 1).length || 1;
  const lbLeafCount =
    lbMetas.length > 0
      ? Math.max(...groupByRound(lbMetas).map((g) => g.items.length), 1)
      : 0;

  const wbWidth = wbLeafCount * cfg.boxW + (wbLeafCount - 1) * cfg.matchGap;
  const lbWidth =
    lbLeafCount > 0 ? lbLeafCount * cfg.boxW + (lbLeafCount - 1) * cfg.matchGap : 0;
  const wbLeft = cfg.padding;
  const lbLeft = wbLeft + wbWidth + (lbWidth > 0 ? cfg.sectionGap : 0);

  const baseBottom =
    cfg.padding + (maxRound + gfMaxRound + 1) * (cfg.boxH + cfg.roundGap);

  const matches: MatchLayout[] = [
    ...placeTreeSection(wbMetas, metas, cfg, baseBottom, (r) => r, wbLeft),
    ...placeTreeSection(lbMetas, metas, cfg, baseBottom, (r) => r, lbLeft),
    ...placeTreeSection(gfMetas, metas, cfg, baseBottom, (r) => maxRound + r, wbLeft),
  ];

  const byId: Record<number, MatchLayout> = {};
  for (const m of matches) byId[m.matchId] = m;

  const connectors: Connector[] = [];
  for (const link of buildAdvanceConnectors(metas)) {
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
    if (!visibleIds.has(link.from) || !visibleIds.has(link.to)) continue;
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
  const yShift = minTop - cfg.padding;

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

export function isConnectorHighlighted(connector: Connector, data: StageData): boolean {
  const from = data.match.find((m) => m.id === connector.fromMatchId);
  const to = data.match.find((m) => m.id === connector.toMatchId);
  if (!from || !to || from.status < Status.Completed) return false;

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
