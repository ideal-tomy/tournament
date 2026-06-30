/** 演出尺（秒）— 従来の約2倍・途切れない盛り上がり */
export const EFFECT_TIMING = {
  winnerShow: 5.0,
  winnerClose: 0.8,
  dim: 0.8,
  lineExtend: 6.0,
  /** 棒上昇の終盤からクラッシュ接近を重ねる */
  lineClashOverlap: 0.8,
  clashApproach: 2.4,
  collisionFlash: 0.6,
  /** 衝突後 — エネルギー蓄積・予感（合計 2.2s の前半） */
  vsAnticipation: 1.2,
  /** 炎の燃え上がり爆発（合計 2.2s の後半） */
  vsFlameBurst: 1.0,
  /** 炎爆発の終盤から VS をにじませる */
  vsRevealOverlap: 0.9,
  vsShow: 4.0,
  close: 1.0,
} as const;

export const EFFECT_EASING = {
  line: 'power1.inOut',
  clash: 'power2.out',
  impact: 'power4.in',
  vsIn: 'back.out(1.6)',
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
    EFFECT_TIMING.vsAnticipation +
    EFFECT_TIMING.vsFlameBurst +
    EFFECT_TIMING.vsShow +
    EFFECT_TIMING.close -
    EFFECT_TIMING.lineClashOverlap -
    EFFECT_TIMING.vsRevealOverlap -
    0.2;
  return winner + advance;
}

export const BRACKET_LABELS: Record<'winner' | 'loser' | 'grand_final', string> = {
  winner: 'WINNERS BRACKET',
  loser: 'LOSERS BRACKET',
  grand_final: 'GRAND FINAL',
};
