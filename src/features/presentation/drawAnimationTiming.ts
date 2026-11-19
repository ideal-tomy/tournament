import type { PresentationMode } from '../../types';
import type { RehearsalTimingPreset } from '../../lib/rehearsalTiming';

/**
 * 抽選演出の調整値（ミリ秒）。
 * GSAPへ渡す直前だけ秒へ変換し、DBの復帰用総尺もこの値から算出する。
 */
export const DRAW_ANIMATION_TIMING = {
  introEnter: 500,
  introHold: 350,
  introExit: 350,
  cardEnter: 500,
  cardSettle: 600,
  dartFlight: 600,
  impactBurst: 450,
  impactHold: 1600,
  cardFlip: 700,
  playerReveal: 800,
  revealHold: 2000,
  memberExit: 500,
  pairReveal: 1000,
  pairConfirmHold: 7000,
  transitionToNext: 800,
  summaryEnter: 650,
  summaryHold: 2200,
  summaryPageHold: 1600,
  summaryPageSlide: 800,
  /** 全チーム紹介で、上下2枚ずつの1画面が通り抜ける秒数。周回の最短待ちには使わない。 */
  summaryPageTravel: 10000,
  shortGridEnter: 650,
  shortGridHold: 1500,
  shortGridExit: 350,
  liteHold: 2500,
} as const;

export type DrawAnimationTimingKey = keyof typeof DRAW_ANIMATION_TIMING;

export function drawTiming(preset:RehearsalTimingPreset='show') {
  if (preset === 'instant') {
    return {
      ...DRAW_ANIMATION_TIMING,
      introEnter: 0,
      introHold: 0,
      introExit: 0,
      cardEnter: 0,
      cardSettle: 0,
      dartFlight: 0,
      impactBurst: 0,
      impactHold: 0,
      cardFlip: 0,
      playerReveal: 0,
      revealHold: 0,
      memberExit: 0,
      pairReveal: 0,
      pairConfirmHold: 0,
      transitionToNext: 0,
      summaryEnter: 0,
      summaryHold: 0,
      summaryPageHold: 0,
      summaryPageSlide: 0,
      summaryPageTravel: 0,
      shortGridEnter: 0,
      shortGridHold: 0,
      shortGridExit: 0,
      liteHold: 0,
    };
  }
  return preset==='fast'?{...DRAW_ANIMATION_TIMING,introHold:150,cardSettle:200,impactHold:450,revealHold:500,pairConfirmHold:1400,summaryHold:1200,summaryPageHold:900,summaryPageSlide:500,summaryPageTravel:4000}:DRAW_ANIMATION_TIMING;
}

/** 縦2横4の巡回。20チーム前後は2周、それより多いと1周半。 */
export function estimateTeamSummaryMs(teamCount: number, preset: RehearsalTimingPreset = 'show'): number {
  const t = drawTiming(preset);
  const pages = Math.max(1, Math.ceil(Math.max(0, teamCount) / 8));
  const loops = teamCount <= 24 ? 2 : 1.5;
  const steps = Math.max(1, Math.ceil(pages * loops));
  return t.summaryEnter + steps * t.summaryPageHold + Math.max(0, steps - 1) * t.summaryPageSlide;
}
export function drawSeconds(key: DrawAnimationTimingKey,preset:RehearsalTimingPreset='show'): number {
  return drawTiming(preset)[key] / 1000;
}

export function estimateDrawDurationMs(
  participantCount: number,
  mode: PresentationMode,
  teamCount = Math.ceil(Math.max(0, Math.floor(participantCount)) / 2),
  preset:RehearsalTimingPreset='show',
): number {
  const count = Math.max(0, Math.floor(participantCount));
  const confirmedTeams = Math.max(0, Math.floor(teamCount));
  const t = drawTiming(preset);

  if (mode === 'lite') return t.liteHold;
  if (mode === 'short') {
    return t.shortGridEnter + t.shortGridHold + t.shortGridExit + estimateTeamSummaryMs(confirmedTeams, preset);
  }

  const intro = t.introEnter + t.introHold + t.introExit;
  const perParticipant =
    t.cardEnter +
    t.cardSettle +
    t.dartFlight +
    t.impactBurst +
    t.impactHold +
    t.cardFlip +
    t.playerReveal +
    t.revealHold +
    t.memberExit;
  const perTeam = t.pairReveal + t.pairConfirmHold + t.transitionToNext;
  const summary = estimateTeamSummaryMs(confirmedTeams, preset);
  return intro + count * perParticipant + confirmedTeams * perTeam + summary;
}

export function estimateDrawDurationSec(
  participantCount: number,
  mode: PresentationMode,
  teamCount?: number,
  preset:RehearsalTimingPreset='show',
): number {
  return Math.ceil(estimateDrawDurationMs(participantCount, mode, teamCount,preset) / 1000);
}
