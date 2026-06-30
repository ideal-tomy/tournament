/** 演出尺（秒）。棒の上昇 ≈ 3s */
export const EFFECT_TIMING = {
  dim: 0.4,
  lineExtend: 3.0,
  collisionFlash: 0.15,
  explosion: 0.8,
  vsShow: 2.0,
  close: 0.6,
} as const;

export const EFFECT_EASING = {
  line: 'power2.inOut',
  vsIn: 'back.out(1.4)',
  vsOut: 'power2.in',
} as const;

export function effectTotalDuration(): number {
  return Object.values(EFFECT_TIMING).reduce((sum, v) => sum + v, 0);
}

export const BRACKET_LABELS: Record<'winner' | 'loser' | 'grand_final', string> = {
  winner: 'WINNERS BRACKET',
  loser: 'LOSERS BRACKET',
  grand_final: 'GRAND FINAL',
};
