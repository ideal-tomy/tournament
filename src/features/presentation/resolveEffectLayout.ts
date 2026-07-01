import {
  computeBracketLayout,
  resolveTeamId,
  type BracketKind,
  type Point,
  type StageData,
} from '../bracket/layout';
import type { AdvanceEffectPayload } from './advanceEffect';

export interface MatchEffectLayout {
  viewBox: { width: number; height: number };
  slotA: Point;
  slotB: Point;
  collision: Point;
  junctionY: number;
  bracket: BracketKind;
  round: number;
}

function winnerLineStart(
  feederLayout: ReturnType<typeof computeBracketLayout>['byId'][number],
  teamId: string,
  data: StageData,
): Point | null {
  for (const slot of feederLayout.slots) {
    const id = resolveTeamId(slot.teamRef, data.participant);
    if (id === teamId) {
      return { x: slot.center.x, y: feederLayout.box.y + feederLayout.box.h };
    }
  }
  for (const slot of feederLayout.slots) {
    if (slot.teamRef != null) {
      return { x: slot.center.x, y: feederLayout.box.y + feederLayout.box.h };
    }
  }
  return null;
}

/** 次試合確定時: 2 フィーダーの勝者位置 → 接合点 */
export function resolveAdvanceEffectLayout(
  data: StageData,
  advance: AdvanceEffectPayload,
): MatchEffectLayout | null {
  const layout = computeBracketLayout(data);
  const parent = layout.byId[advance.nextMatchId];
  const feederA = layout.byId[advance.feederMatchIds[0]];
  const feederB = layout.byId[advance.feederMatchIds[1]];
  if (!parent || !feederA || !feederB) return null;

  const slotA = winnerLineStart(feederA, advance.teamAId, data);
  const slotB = winnerLineStart(feederB, advance.teamBId, data);
  if (!slotA || !slotB) return null;

  const parentBottom = parent.box.y + parent.box.h;
  const junctionY = (Math.min(slotA.y, slotB.y) + parentBottom) / 2;

  return {
    viewBox: { width: layout.width, height: layout.height },
    slotA,
    slotB,
    junctionY,
    collision: { x: parent.center.x, y: junctionY },
    bracket: parent.bracket,
    round: parent.round,
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
