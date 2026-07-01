/** 爆発 WebM の尺（秒）— impact フェーズと同期 */
export const EXPLOSION_VIDEO_SEC = 5;

/** クロスフェード（秒）— レイヤー重なり */
export const CROSSFADE = {
  /** 衝突直後、爆発と重なりながら対戦者を消す */
  teamsOut: 1.4,
  /** 爆発レイヤーのフェードイン */
  explosionIn: 0.9,
  /** 爆発余韻のフェードアウト */
  explosionOut: 1.1,
  /** 爆発が引くタイミングで対戦者を戻す */
  teamsIn: 1.0,
  /** VS — 爆発 fade-out と重ねる */
  vsIn: 1.0,
  /** VS 開始を爆発 fade-out 開始から少し遅らせる */
  vsInLag: 0.2,
  /** 対戦者 fade-in を爆発 fade-out 開始から少し遅らせる */
  teamsInLag: 0.15,
} as const;

/** 演出尺（秒）— Single Timeline 用 */
export const TIMING = {
  win: 3.8,
  dissolve: 0.6,
  pause: 0.5,
  barRise: 2.8,
  clash: 3.0,
  /** 衝突〜爆発ホールド（= EXPLOSION_VIDEO_SEC） */
  impact: EXPLOSION_VIDEO_SEC,
  vsHold: 3.5,
  return: 1.6,
} as const;

export type EffectTiming = typeof TIMING;

export const EFFECT_EASING = {
  line: 'power1.inOut',
  clash: 'power1.out',
  impact: 'power4.in',
  vsIn: 'back.out(1.6)',
  vsOut: 'power2.in',
} as const;

export function effectTotalDuration(includeAdvance = true): number {
  const winner = TIMING.win + TIMING.dissolve;
  if (!includeAdvance) return winner + TIMING.return;
  const barAt = TIMING.win + TIMING.dissolve + TIMING.pause;
  const clashAt = barAt + TIMING.barRise * 0.55;
  const impactAt = clashAt + TIMING.clash;
  const holdAt = impactAt + TIMING.impact;
  const returnAt = holdAt + TIMING.vsHold;
  return returnAt + TIMING.return;
}

export const BRACKET_LABELS: Record<'winner' | 'loser' | 'grand_final', string> = {
  winner: 'WINNERS BRACKET',
  loser: 'LOSERS BRACKET',
  grand_final: 'GRAND FINAL',
};
