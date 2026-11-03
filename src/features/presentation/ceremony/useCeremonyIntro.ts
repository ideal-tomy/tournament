import { useLayoutEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { playPresentationAudio, type PresentationCue } from '../backdrop/playPresentationAudio';

export interface CeremonyIntroOptions {
  startAt?: number;
  settled?: boolean;
  audioEnabled?: boolean;
  /** Replay pages drive the time; the intro then never plays by itself and stays silent. */
  controlledTime?: number;
}

type Build = (tl: gsap.core.Timeline, cue: (name: PresentationCue, at: number) => void) => void;

/** Builds the intro once per mount. Later polls re-render with new team objects and must not restart it. */
export function useCeremonyIntro(stageRef: RefObject<HTMLDivElement>, end: number, build: Build, options: CeremonyIntroOptions) {
  const initial = useRef({ ...options, build });
  const timeline = useRef<gsap.core.Timeline>();
  const restoring = useRef(false);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { startAt = 0, settled = false, audioEnabled = false, controlledTime, build } = initial.current;
    const scrubbed = controlledTime != null;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      timeline.current = tl;
      build(tl, (name, at) => { tl.call(() => { if (!restoring.current) playPresentationAudio(name, audioEnabled && !scrubbed); }, [], at); });
      tl.call(() => stage.classList.add('cer-hold'), [], end).to({}, { duration: end }, 0);
      const at = reduced || settled ? end : Math.min(end, Math.max(0, scrubbed ? controlledTime : startAt));
      if (at > 0.02) {
        restoring.current = true;
        tl.seek(at, false);
        restoring.current = false;
      }
      if (!reduced && !settled && !scrubbed && at < end) tl.play();
    }, stage);
    return () => { timeline.current = undefined; ctx.revert(); };
  }, [stageRef, end]);

  const { controlledTime } = options;
  useLayoutEffect(() => {
    const tl = timeline.current, stage = stageRef.current;
    if (controlledTime == null || !tl || !stage) return;
    const at = Math.min(end, Math.max(0, controlledTime));
    restoring.current = true;
    tl.pause().seek(at, false);
    restoring.current = false;
    stage.classList.toggle('cer-hold', at >= end);
  }, [controlledTime, end, stageRef]);
}
