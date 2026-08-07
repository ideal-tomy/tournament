import type { PresentationMode } from '../../types';

/**
 * 抽選演出の調整値（ミリ秒）。
 * GSAPへ渡す直前だけ秒へ変換し、DBの復帰用総尺もこの値から算出する。
 */
export const DRAW_ANIMATION_TIMING = {
  introEnter: 500,
  introHold: 350,
  introExit: 350,
  cardEnter: 350,
  dartFlight: 600,
  impactBurst: 450,
  impactHold: 2000,
  impactClear: 200,
  cardFlip: 700,
  playerReveal: 800,
  memberExit: 500,
  pairReveal: 1000,
  pairConfirmHold: 7000,
  transitionToNext: 800,
  summaryEnter: 650,
  summaryHold: 2200,
  shortGridEnter: 650,
  shortGridHold: 1500,
  shortGridExit: 350,
  liteHold: 2500,
} as const;

export type DrawAnimationTimingKey = keyof typeof DRAW_ANIMATION_TIMING;

export function drawSeconds(key: DrawAnimationTimingKey): number {
  return DRAW_ANIMATION_TIMING[key] / 1000;
}

export function estimateDrawDurationMs(
  participantCount: number,
  mode: PresentationMode,
  teamCount = Math.ceil(Math.max(0, Math.floor(participantCount)) / 2),
): number {
  const count = Math.max(0, Math.floor(participantCount));
  const confirmedTeams = Math.max(0, Math.floor(teamCount));
  const t = DRAW_ANIMATION_TIMING;

  if (mode === 'lite') return t.liteHold;
  if (mode === 'short') {
    return t.shortGridEnter + t.shortGridHold + t.shortGridExit + t.summaryEnter + t.summaryHold;
  }

  const intro = t.introEnter + t.introHold + t.introExit;
  const perParticipant =
    t.cardEnter +
    t.dartFlight +
    t.impactBurst +
    t.impactHold +
    t.impactClear +
    t.cardFlip +
    t.playerReveal +
    t.memberExit;
  const perTeam = t.pairReveal + t.pairConfirmHold + t.transitionToNext;
  const summary = t.summaryEnter + t.summaryHold;
  return intro + count * perParticipant + confirmedTeams * perTeam + summary;
}

export function estimateDrawDurationSec(
  participantCount: number,
  mode: PresentationMode,
  teamCount?: number,
): number {
  return Math.ceil(estimateDrawDurationMs(participantCount, mode, teamCount) / 1000);
}
