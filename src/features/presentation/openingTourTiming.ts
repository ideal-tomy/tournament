import type { BMMatch, StageData } from '../bracket/layout';
import { computeBracketLayout, findFeederMatches } from '../bracket/layout';

/** 会場画面。全体も寄りもこの比に合わせ、左右の余白を足さない。 */
export const SCREEN_ASPECT = 16 / 9;
/** 最初の全体表示。 */
export const BRACKET_TOUR_OVERVIEW_SEC = 2;
/** 左端の初戦へ寄る。最初は遅く、終わりにかけて加速する。 */
export const BRACKET_TOUR_APPROACH_SEC = 2;
/** 隣の初戦カードへ滑る時間。 */
export const BRACKET_TOUR_CARD_SEC = 0.85;
/** 右端から全体へ戻る時間。 */
export const BRACKET_TOUR_RETURN_SEC = 3;

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

function teamKey(data: StageData, participantId: number | null | undefined): string | null {
  if (participantId == null) return null;
  return data.participant.find((row) => row.id === participantId)?.name ?? null;
}

function teamsInMatch(data: StageData, match: BMMatch): string[] {
  return [match.opponent1?.id, match.opponent2?.id]
    .map((id) => teamKey(data, id))
    .filter((team): team is string => team != null);
}

/** 一番下に並ぶ初戦を左から右へ、1カードずつ。不戦勝同士の対戦も含む。 */
export function openingTourStops(data: StageData): OpeningTourStop[] {
  const layout = computeBracketLayout(data, undefined, 'winners');
  return layout.matches
    .filter((match) => match.bracket === 'winner' && match.isLeafRound)
    .sort((a, b) => a.box.x - b.box.x || a.matchId - b.matchId)
    .map((match) => {
      const source = data.match.find((row) => row.id === match.matchId);
      return { matchIds: [match.matchId], teamIds: source ? teamsInMatch(data, source) : [] };
    });
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

function lerpFrame(from: OpeningTourFrame, to: OpeningTourFrame, amount: number): OpeningTourFrame {
  const cx = from.x + from.w / 2 + (to.x + to.w / 2 - (from.x + from.w / 2)) * amount;
  const cy = from.y + from.h / 2 + (to.y + to.h / 2 - (from.y + from.h / 2)) * amount;
  const w = from.w + (to.w - from.w) * amount;
  const h = from.h + (to.h - from.h) * amount;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 表の外接を会場の比率まで広げる。横長の表は左右を画面端まで使う。 */
export function openingOverviewFrame(data: StageData): OpeningTourFrame {
  const layout = computeBracketLayout(data, undefined, 'winners');
  const boxes = layout.matches.filter((match) => match.bracket === 'winner').map((match) => match.box);
  if (!boxes.length) return fitTourAspect({ x: 0, y: 0, w: layout.width, h: layout.height }, SCREEN_ASPECT);
  const pad = 16;
  const left = Math.min(...boxes.map((box) => box.x)) - pad;
  const right = Math.max(...boxes.map((box) => box.x + box.w)) + pad;
  const top = Math.min(...boxes.map((box) => box.y)) - pad;
  const bottom = Math.max(...boxes.map((box) => box.y + box.h)) + pad;
  return fitTourAspect({ x: left, y: top, w: right - left, h: bottom - top }, SCREEN_ASPECT);
}

/** 初戦カードを大きく収める。カードごとの枠サイズは揃える。 */
export function openingCardFrames(data: StageData): OpeningTourFrame[] {
  const layout = computeBracketLayout(data, undefined, 'winners');
  const boxes = openingTourStops(data).map((stop) => layout.byId[stop.matchIds[0]]?.box).filter((box) => box != null);
  if (!boxes.length) return [];
  const tallest = Math.max(...boxes.map((box) => box.h));
  const widest = Math.max(...boxes.map((box) => box.w));
  let height = tallest / 0.62;
  let width = height * SCREEN_ASPECT;
  if (width < widest / 0.72) {
    width = widest / 0.72;
    height = width / SCREEN_ASPECT;
  }
  return boxes.map((box) => ({
    x: box.x + box.w / 2 - width / 2,
    y: box.y + box.h / 2 - height / 2,
    w: width,
    h: height,
  }));
}

function easeIn(amount: number) {
  return amount * amount * amount;
}
function easeOut(amount: number) {
  const rest = 1 - amount;
  return 1 - rest * rest * rest;
}
function easeInOut(amount: number) {
  return amount < 0.5 ? 4 * amount * amount * amount : 1 - ((-2 * amount + 2) ** 3) / 2;
}

export function openingTourPanSec(cardCount: number) {
  return Math.max(0, cardCount - 1) * BRACKET_TOUR_CARD_SEC;
}

/** 全体 → 加速して左端へ → 初戦を滑る → 全体へ戻る。 */
export function openingTourViewAt(
  elapsed: number,
  full: OpeningTourFrame,
  frames: OpeningTourFrame[],
): OpeningTourFrame {
  if (elapsed <= BRACKET_TOUR_OVERVIEW_SEC || !frames.length) return full;
  const approachEnd = BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC;
  if (elapsed <= approachEnd) {
    return lerpFrame(full, frames[0], easeIn((elapsed - BRACKET_TOUR_OVERVIEW_SEC) / BRACKET_TOUR_APPROACH_SEC));
  }
  const pan = openingTourPanSec(frames.length);
  const panEnd = approachEnd + pan;
  if (elapsed <= panEnd && frames.length > 1) {
    const pos = easeInOut((elapsed - approachEnd) / pan) * (frames.length - 1);
    const index = Math.min(frames.length - 2, Math.floor(pos));
    return lerpFrame(frames[index], frames[index + 1], pos - index);
  }
  const back = elapsed - panEnd;
  if (back >= BRACKET_TOUR_RETURN_SEC) return full;
  return lerpFrame(frames[frames.length - 1], full, easeOut(back / BRACKET_TOUR_RETURN_SEC));
}

export function openingTourPhase(
  elapsed: number,
  stopCount: number,
): 'overview' | 'in' | 'pan' | 'out' | 'done' {
  if (elapsed < BRACKET_TOUR_OVERVIEW_SEC) return 'overview';
  const approachEnd = BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC;
  if (elapsed < approachEnd) return 'in';
  const panEnd = approachEnd + openingTourPanSec(stopCount);
  if (elapsed < panEnd) return 'pan';
  if (elapsed < panEnd + BRACKET_TOUR_RETURN_SEC) return 'out';
  return 'done';
}

export function openingTourCaptionIndex(elapsed: number, stopCount: number): number | null {
  if (stopCount < 1 || elapsed < BRACKET_TOUR_OVERVIEW_SEC) return null;
  const approachEnd = BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC;
  const panEnd = approachEnd + openingTourPanSec(stopCount);
  if (elapsed < approachEnd) return 0;
  if (elapsed >= panEnd) return null;
  if (stopCount === 1) return 0;
  const pos = easeInOut((elapsed - approachEnd) / (panEnd - approachEnd)) * (stopCount - 1);
  return Math.min(stopCount - 1, Math.round(pos));
}

/** 全体、寄り、初戦の移動、戻り。最後は全体で止まる。 */
export function openingTourDurationSec(data: StageData): number {
  const cards = openingTourStops(data).length;
  return BRACKET_TOUR_OVERVIEW_SEC + BRACKET_TOUR_APPROACH_SEC + openingTourPanSec(cards) + BRACKET_TOUR_RETURN_SEC;
}
