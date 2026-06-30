import {
  computeBracketLayout,
  type BracketKind,
  type Point,
  type StageData,
} from '../bracket/layout';

export interface MatchEffectLayout {
  viewBox: { width: number; height: number };
  slotA: Point;
  slotB: Point;
  collision: Point;
  bracket: BracketKind;
  round: number;
}

export function resolveMatchEffectLayout(
  data: StageData,
  matchId: number,
): MatchEffectLayout | null {
  const layout = computeBracketLayout(data);
  const match = layout.byId[matchId];
  if (!match) return null;

  return {
    viewBox: { width: layout.width, height: layout.height },
    slotA: match.slots[0].center,
    slotB: match.slots[1].center,
    collision: match.center,
    bracket: match.bracket,
    round: match.round,
  };
}

/** viewBox 座標 → コンテナ内パーセント（0–100） */
export function viewBoxToPercent(
  point: Point,
  viewBox: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: (point.x / viewBox.width) * 100,
    y: (point.y / viewBox.height) * 100,
  };
}
