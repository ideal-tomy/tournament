import type { BMMatch, StageData } from '../bracket/layout';
import { computeBracketLayout, findFeederMatches, findParentMatch } from '../bracket/layout';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';

/** 最初の全体表示。 */
export const BRACKET_TOUR_OVERVIEW_SEC = 2;
/** 寄る時間と、引いて全体へ戻る時間。 */
export const BRACKET_TOUR_ZOOM_SEC = 1;
/** 顔と対戦相手が読める位置で止める時間。 */
export const BRACKET_TOUR_HOLD_SEC = 4;

const CLUSTER_LIMIT = 2;

export interface OpeningTourStop {
  matchIds: number[];
  teamIds: string[];
}

export interface OpeningTourFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

function winnerMatches(data: StageData): BMMatch[] {
  return data.match
    .filter((match) => getMatchBracketKind(data, match) === 'winner')
    .sort(
      (a, b) =>
        getMatchRoundLabel(data, a) - getMatchRoundLabel(data, b) ||
        a.number - b.number ||
        a.id - b.id,
    );
}

function teamKey(data: StageData, participantId: number | null | undefined): string | null {
  if (participantId == null) return null;
  return data.participant.find((row) => row.id === participantId)?.name ?? null;
}

function isOneSided(match: BMMatch): boolean {
  return (match.opponent1?.id != null) !== (match.opponent2?.id != null);
}

function firstContest(appearances: BMMatch[]): BMMatch {
  let chosen = appearances[0];
  for (const match of appearances) {
    chosen = match;
    if (!isOneSided(match)) break;
  }
  return chosen;
}

/** 各チームの初戦を1回だけ、左から右へ。不戦勝で上下に同じ顔があっても1回。 */
export function openingTourStops(data: StageData): OpeningTourStop[] {
  const appearances = new Map<string, BMMatch[]>();
  for (const match of winnerMatches(data)) {
    for (const participantId of [match.opponent1?.id, match.opponent2?.id]) {
      const team = teamKey(data, participantId);
      if (!team) continue;
      const list = appearances.get(team) ?? [];
      list.push(match);
      appearances.set(team, list);
    }
  }

  const teamsByMatch = new Map<number, string[]>();
  for (const [team, list] of appearances) {
    if (!list.length) continue;
    const matchId = firstContest(list).id;
    const teams = teamsByMatch.get(matchId) ?? [];
    teams.push(team);
    teamsByMatch.set(matchId, teams);
  }

  const layout = computeBracketLayout(data, undefined, 'winners');
  const ordered = [...teamsByMatch.keys()]
    .map((id) => ({ id, box: layout.byId[id]?.box, round: getMatchRoundLabel(data, data.match.find((match) => match.id === id)!) }))
    .filter((item): item is { id: number; box: NonNullable<typeof item.box>; round: number } => item.box != null)
    .sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y || a.id - b.id);

  const stops: Array<OpeningTourStop & { round: number; right: number }> = [];
  for (const item of ordered) {
    const last = stops[stops.length - 1];
    const beside =
      last != null &&
      last.round === item.round &&
      last.matchIds.length < CLUSTER_LIMIT &&
      item.box.x - last.right <= item.box.w * 1.8;
    if (last && beside) {
      last.matchIds.push(item.id);
      last.teamIds.push(...(teamsByMatch.get(item.id) ?? []));
      last.right = item.box.x + item.box.w;
      continue;
    }
    stops.push({
      matchIds: [item.id],
      teamIds: [...(teamsByMatch.get(item.id) ?? [])],
      round: item.round,
      right: item.box.x + item.box.w,
    });
  }
  return stops.map(({ matchIds, teamIds }) => ({ matchIds, teamIds }));
}

export function openingTourCaption(
  data: StageData,
  matchIds: number[],
  labelByTeamId: Record<string, string>,
): string {
  return matchIds
    .map((id) => {
      const match = data.match.find((row) => row.id === id);
      return match ? `${sideLabel(data, match, 0, labelByTeamId)} 対 ${sideLabel(data, match, 1, labelByTeamId)}` : '';
    })
    .filter((line) => line.length > 0)
    .join('　　');
}

function sideLabel(
  data: StageData,
  match: BMMatch,
  slot: 0 | 1,
  labelByTeamId: Record<string, string>,
): string {
  const opponent = slot === 0 ? match.opponent1 : match.opponent2;
  const team = teamKey(data, opponent?.id);
  if (team) return labelByTeamId[team] || team;
  const feeder = findFeederMatches(data, match.id)[slot];
  if (!feeder) return '未定';
  const names = [feeder.opponent1?.id, feeder.opponent2?.id]
    .map((id) => {
      const key = teamKey(data, id);
      return key ? labelByTeamId[key] || key : null;
    })
    .filter((name): name is string => name != null);
  if (names.length >= 2) return `${names[0]}対${names[1]}の勝者`;
  if (names.length === 1) return `${names[0]}の対戦の勝者`;
  return '勝者';
}

/** その試合と、上下につながる隣の枠が入る範囲。 */
export function openingTourFrame(data: StageData, matchIds: number[]): OpeningTourFrame {
  const layout = computeBracketLayout(data, undefined, 'winners');
  const ids = new Set<number>(matchIds);
  for (const id of matchIds) {
    const parent = findParentMatch(data, id);
    if (parent && layout.byId[parent.id]) ids.add(parent.id);
    for (const feeder of findFeederMatches(data, id)) {
      if (layout.byId[feeder.id]) ids.add(feeder.id);
    }
  }
  const boxes = [...ids].map((id) => layout.byId[id]?.box).filter((box) => box != null);
  if (!boxes.length) return { x: 0, y: 0, w: layout.width, h: layout.height };
  const padX = boxes[0].w * 0.55;
  const padY = boxes[0].h * 0.7;
  const x = Math.max(0, Math.min(...boxes.map((box) => box.x)) - padX);
  const y = Math.max(0, Math.min(...boxes.map((box) => box.y)) - padY);
  const right = Math.min(layout.width, Math.max(...boxes.map((box) => box.x + box.w)) + padX);
  const bottom = Math.min(layout.height, Math.max(...boxes.map((box) => box.y + box.h)) + padY);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

export function openingTourPhase(
  elapsed: number,
  stopCount: number,
): 'overview' | 'in' | 'hold' | 'out' | 'done' {
  if (elapsed < BRACKET_TOUR_OVERVIEW_SEC) return 'overview';
  const cycle = BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC + BRACKET_TOUR_ZOOM_SEC;
  const into = elapsed - BRACKET_TOUR_OVERVIEW_SEC;
  if (into >= stopCount * cycle) return 'done';
  const local = into % cycle;
  if (local < BRACKET_TOUR_ZOOM_SEC) return 'in';
  if (local < BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC) return 'hold';
  return 'out';
}

export function openingTourCaptionIndex(elapsed: number, stopCount: number): number | null {
  if (elapsed < BRACKET_TOUR_OVERVIEW_SEC || stopCount < 1) return null;
  const cycle = BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC + BRACKET_TOUR_ZOOM_SEC;
  const index = Math.floor((elapsed - BRACKET_TOUR_OVERVIEW_SEC) / cycle);
  return index >= 0 && index < stopCount ? index : null;
}

/** 全体2秒のあと、対象ごとに寄る・止める・引く。最後は全体で止まる。 */
export function openingTourDurationSec(data: StageData): number {
  const cycle = BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC + BRACKET_TOUR_ZOOM_SEC;
  return BRACKET_TOUR_OVERVIEW_SEC + openingTourStops(data).length * cycle;
}
