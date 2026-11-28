/** 手前の画面が溶けて消える時間。次の画面も同じ長さで入る。 */
export const ADVANCE_FADE_SEC = 2.2;
/** 手前がこの不透明度まで落ちたとき、次の画面を出し始める。 */
export const ADVANCE_CROSS_AT = 0.7;

/** 線が着いてから、次の画面が完全に出るまで。 */
export const ADVANCE_CROSS_SPAN_SEC = ADVANCE_FADE_SEC * (2 - ADVANCE_CROSS_AT);

/** 試合カードから線が上がり、全体表示に戻るまで。 */
export const WINNER_ADVANCE_SEC = 6;

export function advanceCrossInAt(startSec: number): number {
  return startSec + ADVANCE_FADE_SEC * (1 - ADVANCE_CROSS_AT);
}
