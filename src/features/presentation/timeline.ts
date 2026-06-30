import gsap from 'gsap';
import { EFFECT_TIMING } from './effectConstants';

export interface MatchTimelineCallbacks {
  onDimStart: () => void;
  onLinesStart: () => void;
  onLineProgress: (progress: number) => void;
  onCollision: () => void;
  onExplosion: () => void;
  onVsShow: () => void;
  onClose: () => void;
  onComplete: () => void;
}

export function buildMatchTimeline(callbacks: MatchTimelineCallbacks): gsap.core.Timeline {
  const tl = gsap.timeline({
    onComplete: callbacks.onComplete,
  });

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

export function skipTimeline(tl: gsap.core.Timeline): void {
  tl.progress(1);
  tl.kill();
}
