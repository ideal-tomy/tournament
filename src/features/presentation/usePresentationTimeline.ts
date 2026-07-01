import { useLayoutEffect, useRef, type RefObject } from 'react';
import { TIMING } from './effectConstants';
import { buildMatchTimeline, skipTimeline, type StageRefObjects } from './timeline';

interface ActiveTimeline {
  matchId: number;
  advance: boolean;
}

export function usePresentationTimeline(
  stageRef: RefObject<HTMLElement | null>,
  refs: StageRefObjects,
  active: ActiveTimeline | null,
  fireExplosion: () => void,
  onComplete: () => void,
  onTimelineReady?: (kill: () => void) => void,
): void {
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const onCompleteRef = useRef(onComplete);
  const fireExplosionRef = useRef(fireExplosion);
  const onTimelineReadyRef = useRef(onTimelineReady);
  onCompleteRef.current = onComplete;
  fireExplosionRef.current = fireExplosion;
  onTimelineReadyRef.current = onTimelineReady;

  useLayoutEffect(() => {
    if (!active || !stageRef.current) return;

    const tl = buildMatchTimeline(refs, TIMING, {
      advance: active.advance,
      fireExplosion: () => fireExplosionRef.current(),
    });
    tl.eventCallback('onComplete', () => onCompleteRef.current());
    tlRef.current = tl;

    onTimelineReadyRef.current?.(() => {
      if (tlRef.current) skipTimeline(tlRef.current);
    });

    return () => {
      tl.kill();
      tlRef.current = null;
    };
  }, [active?.matchId, active?.advance]);
}
