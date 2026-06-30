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
  roundGap: number;
  matchGap: number;
  sectionGap: number;
  padding: number;
}
export const DEFAULT_LAYOUT: LayoutConfig = {
  boxW: 108,
  boxH: 152,
  roundGap: 64,
  matchGap: 10,
  sectionGap: 36,
  padding: 44,
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

export function computeBracketLayout(
  data: StageData,
  cfg: LayoutConfig = DEFAULT_LAYOUT,
): BracketLayout {
  const metas = buildMatchMetas(data);
  const wbMetas = metas.filter((m) => m.bracket === 'winner');
  const lbMetas = metas.filter((m) => m.bracket === 'loser');
  const gfMetas = metas.filter((m) => m.bracket === 'grand_final');

  const wbMaxRound = wbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const lbMaxRound = lbMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const gfMaxRound = gfMetas.reduce((mx, m) => Math.max(mx, m.round), 0);
  const maxRound = Math.max(wbMaxRound, lbMaxRound, gfMaxRound, 1);

  const maxInRound = (items: MatchMeta[]) => {
    const rounds = groupByRound(items);
    if (!rounds.length) return 1;
    return Math.max(1, ...rounds.map((g) => g.items.length));
  };

  const wbWidth = maxInRound(wbMetas) * (cfg.boxW + cfg.matchGap);
  const lbWidth = maxInRound(lbMetas) * (cfg.boxW + cfg.matchGap);
  const gfWidth = cfg.boxW + cfg.matchGap;
  const totalW = wbWidth + cfg.sectionGap + lbWidth;
  const wbLeft = cfg.padding + Math.max(0, (totalW - wbWidth - cfg.sectionGap - lbWidth) / 2);
  const lbLeft = wbLeft + wbWidth + cfg.sectionGap;
  const gfLeft = cfg.padding + (totalW - gfWidth) / 2;

  const baseBottom =
    cfg.padding + (maxRound + gfMaxRound + 1) * (cfg.boxH + cfg.roundGap);

  function placeSection(
    items: MatchMeta[],
    sectionLeft: number,
    sectionWidth: number,
    roundOffset: (round: number) => number,
  ): MatchLayout[] {
    const layouts: MatchLayout[] = [];
    const byRound = groupByRound(items);

    for (const { round, items: roundItems } of byRound) {
      const rowFromBottom = roundOffset(round);
      const boxY = baseBottom - rowFromBottom * (cfg.boxH + cfg.roundGap);
      const n = roundItems.length;
      const rowWidth = n * cfg.boxW + (n - 1) * cfg.matchGap;
      const startX = sectionLeft + (sectionWidth - rowWidth) / 2;

      roundItems.forEach((meta, row) => {
        const boxX = startX + row * (cfg.boxW + cfg.matchGap);
        const box: Rect = { x: boxX, y: boxY, w: cfg.boxW, h: cfg.boxH };
        const slotW = cfg.boxW / 2;
        const mkSlot = (slot: 0 | 1, op: BMOpponent | null): SlotLayout => {
          const rect: Rect = {
            x: boxX + slot * slotW,
            y: boxY,
            w: slotW,
            h: cfg.boxH,
          };
          return {
            slot,
            teamRef: op?.id ?? null,
            rect,
            center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
          };
        };
        layouts.push({
          matchId: meta.match.id,
          bracket: meta.bracket,
          round: meta.round,
          col: round - 1,
          row,
          box,
          center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
          slots: [mkSlot(0, meta.match.opponent1), mkSlot(1, meta.match.opponent2)],
        });
      });
    }
    return layouts;
  }

  const matches: MatchLayout[] = [
    ...placeSection(wbMetas, wbLeft, wbWidth, (r) => r),
    ...placeSection(lbMetas, lbLeft, lbWidth, (r) => r),
    ...placeSection(gfMetas, gfLeft, gfWidth, (r) => maxRound + r),
  ];

  const byId: Record<number, MatchLayout> = {};
  for (const m of matches) byId[m.matchId] = m;

  const connectors: Connector[] = [];
  for (const link of buildAdvanceConnectors(metas)) {
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
  const width = maxRight + cfg.padding;
  const height = baseBottom + cfg.boxH + cfg.padding - minTop + cfg.padding;

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
