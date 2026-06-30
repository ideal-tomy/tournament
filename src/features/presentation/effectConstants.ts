/** 演出尺（秒） */
export const EFFECT_TIMING = {
  winnerShow: 2.2,
  winnerClose: 0.4,
  dim: 0.35,
  lineExtend: 3.0,
  clashApproach: 0.9,
  collisionFlash: 0.25,
  explosion: 1.0,
  vsShow: 2.0,
  close: 0.55,
} as const;

export const EFFECT_EASING = {
  line: 'power2.inOut',
  vsIn: 'back.out(1.4)',
  vsOut: 'power2.in',
} as const;

export function effectTotalDuration(includeAdvance = true): number {
  const winner = EFFECT_TIMING.winnerShow + EFFECT_TIMING.winnerClose;
  if (!includeAdvance) return winner;
  const advance =
    EFFECT_TIMING.dim +
    EFFECT_TIMING.lineExtend +
    EFFECT_TIMING.clashApproach +
    EFFECT_TIMING.collisionFlash +
    EFFECT_TIMING.explosion +
    EFFECT_TIMING.vsShow +
    EFFECT_TIMING.close;
  return winner + advance;
}

export const BRACKET_LABELS: Record<'winner' | 'loser' | 'grand_final', string> = {
  winner: 'WINNERS BRACKET',
  loser: 'LOSERS BRACKET',
  grand_final: 'GRAND FINAL',
};
