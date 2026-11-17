import type { BMMatch, StageData } from '../bracket/layout';
import { computeBracketLayout, findFeederMatches, findParentMatch } from '../bracket/layout';
import { getMatchBracketKind, getMatchRoundLabel } from '../progression/tiers';

/** 最初の全体表示。 */
export const BRACKET_TOUR_OVERVIEW_SEC = 2;
/** 寄る時間と、引いて全体へ戻る時間。直線補間なので縦横比は変えない。 */
export const BRACKET_TOUR_ZOOM_SEC = 2.8;
/** 顔と対戦相手が読める位置で止める時間。 */
export const BRACKET_TOUR_HOLD_SEC = 4;
/** 左から右へ止める回数。下段はこの回数で等分する。 */
export const BRACKET_TOUR_STOPS = 4;

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

function teamsInMatch(data: StageData, match: BMMatch): string[] {
  return [match.opponent1?.id, match.opponent2?.id]
    .map((id) => teamKey(data, id))
    .filter((team): team is string => team != null);
}

/** 下段を左から4区画に分け、各区画を1回だけ寄る。 */
export function openingTourStops(data: StageData): OpeningTourStop[] {
  const layout = computeBracketLayout(data, undefined, 'winners');
  const leaves = winnerMatches(data)
    .filter((match) => getMatchRoundLabel(data, match) === 1 && layout.byId[match.id])
    .sort((a, b) => layout.byId[a.id].box.x - layout.byId[b.id].box.x || a.id - b.id);
  const groups = Math.min(BRACKET_TOUR_STOPS, leaves.length);
  if (!groups) return [];
  const base = Math.floor(leaves.length / groups);
  const extra = leaves.length % groups;
  const stops: OpeningTourStop[] = [];
  let index = 0;
  for (let group = 0; group < groups; group += 1) {
    const size = base + (group < extra ? 1 : 0);
    const matches = leaves.slice(index, index + size);
    index += size;
    const teamIds = [...new Set(matches.flatMap((match) => teamsInMatch(data, match)))];
    stops.push({ matchIds: matches.map((match) => match.id), teamIds });
  }
  return stops;
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

function boxCenter(box: { x: number; y: number; w: number; h: number }) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** 中心を動かさず、画面と同じ縦横比まで広げる。 */
export function fitTourAspect(frame: OpeningTourFrame, aspect: number): OpeningTourFrame {
  if (!(aspect > 0) || frame.h <= 0) return frame;
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  let { w, h } = frame;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 下段の区画を収め、2段目の中心が画面中央に来る範囲。 */
export function openingTourFrame(data: StageData, matchIds: number[], aspect = 0): OpeningTourFrame {
  const layout = computeBracketLayout(data, undefined, 'winners');
  const leaves = matchIds.map((id) => layout.byId[id]?.box).filter((box) => box != null);
  if (!leaves.length) return { x: 0, y: 0, w: layout.width, h: layout.height };
  const parents = [...new Set(matchIds.map((id) => findParentMatch(data, id)?.id).filter((id): id is number => id != null))]
    .map((id) => layout.byId[id]?.box)
    .filter((box) => box != null);
  const grandparents = [...new Set(matchIds.map((id) => findParentMatch(data, id)?.id).filter((id): id is number => id != null))]
    .map((id) => findParentMatch(data, id)?.id)
    .filter((id): id is number => id != null);
  const upper = [...new Set(grandparents)].map((id) => layout.byId[id]?.box).filter((box) => box != null);
  const second = parents.length ? parents : leaves;
  const center = second.reduce((sum, box) => {
    const point = boxCenter(box);
    return { x: sum.x + point.x / second.length, y: sum.y + point.y / second.length };
  }, { x: 0, y: 0 });
  const boxes = [...leaves, ...parents, ...upper];
  const pad = 8;
  const left = Math.min(...boxes.map((box) => box.x)) - pad;
  const right = Math.max(...boxes.map((box) => box.x + box.w)) + pad;
  const top = Math.min(...boxes.map((box) => box.y)) - pad;
  const bottom = Math.max(...boxes.map((box) => box.y + box.h)) + pad;
  let halfW = Math.max(center.x - left, right - center.x);
  let halfH = Math.max(center.y - top, bottom - center.y);
  if (aspect > 0) {
    if (halfW / halfH < aspect) halfW = halfH * aspect;
    else halfH = halfW / aspect;
  }
  return { x: center.x - halfW, y: center.y - halfH, w: halfW * 2, h: halfH * 2 };
}

/** 縦横比を保ったまま、中心と幅だけを直線に補間する。 */
export function openingTourViewAt(
  elapsed: number,
  full: OpeningTourFrame,
  frames: OpeningTourFrame[],
): OpeningTourFrame {
  const lerp = (from: OpeningTourFrame, to: OpeningTourFrame, amount: number): OpeningTourFrame => {
    const t = -(Math.cos(Math.PI * amount) - 1) / 2;
    const cx = from.x + from.w / 2 + (to.x + to.w / 2 - (from.x + from.w / 2)) * t;
    const cy = from.y + from.h / 2 + (to.y + to.h / 2 - (from.y + from.h / 2)) * t;
    const w = from.w + (to.w - from.w) * t;
    const h = from.h + (to.h - from.h) * t;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  if (elapsed <= BRACKET_TOUR_OVERVIEW_SEC || !frames.length) return full;
  const cycle = BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC + BRACKET_TOUR_ZOOM_SEC;
  const into = elapsed - BRACKET_TOUR_OVERVIEW_SEC;
  if (into >= frames.length * cycle) return full;
  const index = Math.min(frames.length - 1, Math.floor(into / cycle));
  const local = into - index * cycle;
  const target = frames[index];
  if (local < BRACKET_TOUR_ZOOM_SEC) return lerp(full, target, local / BRACKET_TOUR_ZOOM_SEC);
  if (local < BRACKET_TOUR_ZOOM_SEC + BRACKET_TOUR_HOLD_SEC) return target;
  return lerp(target, full, (local - BRACKET_TOUR_ZOOM_SEC - BRACKET_TOUR_HOLD_SEC) / BRACKET_TOUR_ZOOM_SEC);
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
