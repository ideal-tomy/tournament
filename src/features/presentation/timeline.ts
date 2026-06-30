import gsap from 'gsap';
import { EFFECT_TIMING } from './effectConstants';

export interface WinnerTimelineCallbacks {
  onShow: () => void;
  onClose: () => void;
}

export interface AdvanceTimelineCallbacks {
  onDimStart: () => void;
  onLinesStart: () => void;
  onLineProgress: (progress: number) => void;
  onClashStart: () => void;
  onCollision: () => void;
  onExplosion: () => void;
  onVsShow: () => void;
  onClose: () => void;
}

export function buildAdvanceTimeline(callbacks: AdvanceTimelineCallbacks): gsap.core.Timeline {
  const tl = gsap.timeline();
  const lineState = { progress: 0 };

  tl.add(() => callbacks.onDimStart());
  tl.to({}, { duration: EFFECT_TIMING.dim });

  tl.add(() => callbacks.onLinesStart());
  tl.to(lineState, {
    progress: 1,
    duration: EFFECT_TIMING.lineExtend,
    ease: 'power2.inOut',
    onUpdate: () => callbacks.onLineProgress(lineState.progress),
  });

  tl.add(() => callbacks.onClashStart());
  tl.to({}, { duration: EFFECT_TIMING.clashApproach });

  tl.add(() => callbacks.onCollision());
  tl.to({}, { duration: EFFECT_TIMING.collisionFlash });

  tl.add(() => callbacks.onExplosion());
  tl.to({}, { duration: EFFECT_TIMING.explosion });

  tl.add(() => callbacks.onVsShow());
  tl.to({}, { duration: EFFECT_TIMING.vsShow });

  tl.add(() => callbacks.onClose());
  tl.to({}, { duration: EFFECT_TIMING.close });

  return tl;
}

export function buildWinnerTimeline(callbacks: WinnerTimelineCallbacks): gsap.core.Timeline {
  const tl = gsap.timeline();
  tl.add(() => callbacks.onShow());
  tl.to({}, { duration: EFFECT_TIMING.winnerShow });
  tl.add(() => callbacks.onClose());
  tl.to({}, { duration: EFFECT_TIMING.winnerClose });
  return tl;
}

export function buildPresentationTimeline(
  hasAdvance: boolean,
  winner: WinnerTimelineCallbacks,
  advance?: AdvanceTimelineCallbacks,
  onComplete?: () => void,
): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete });

  tl.add(buildWinnerTimeline(winner));
  if (hasAdvance && advance) {
    tl.add(buildAdvanceTimeline(advance));
  }

  return tl;
}

/** @deprecated buildMatchTimeline の後方互換 */
export interface MatchTimelineCallbacks extends AdvanceTimelineCallbacks {
  onComplete: () => void;
}

export function buildMatchTimeline(callbacks: MatchTimelineCallbacks): gsap.core.Timeline {
  const { onComplete, ...advance } = callbacks;
  return buildAdvanceTimeline(advance).eventCallback('onComplete', onComplete);
}

export function skipTimeline(tl: gsap.core.Timeline): void {
  tl.progress(1);
  tl.kill();
}
