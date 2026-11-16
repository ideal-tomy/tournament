import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import CeremonyFrame from '../ceremony/CeremonyFrame';
import { playPresentationAudio } from '../backdrop/playPresentationAudio';
import { LOSERS_INTRO_TITLE_SEC } from '../losersIntroTiming';

/** Full-screen beat before the losers bracket board. Missing audio fails silently. */
export default function LosersIntro({
  startAt = 0,
  audioEnabled = false,
  contained = false,
  durationSec = LOSERS_INTRO_TITLE_SEC,
}: {
  startAt?: number;
  audioEnabled?: boolean;
  contained?: boolean;
  durationSec?: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hold = Math.max(LOSERS_INTRO_TITLE_SEC, durationSec);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tl.set('.li-title', { autoAlpha: 0, scale: 1.4 })
        .set('.li-sub', { autoAlpha: 0, y: 24 })
        .fromTo('.li-scene', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0)
        .to('.li-title', { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'expo.out' }, 0.2)
        .to('.li-sub', { autoAlpha: 1, y: 0, duration: 0.45 }, 0.7)
        .call(() => { playPresentationAudio('losersOpen', audioEnabled); }, [], 0.25)
        .to({}, { duration: hold }, 0);
      tl.seek(Math.min(hold, Math.max(0, startAt)), false);
      if (startAt < hold - 0.05) tl.play();
    }, stage);
    return () => ctx.revert();
  }, [startAt, audioEnabled, hold]);

  return (
    <CeremonyFrame stageRef={stageRef} contained={contained} className="li-board" label="ルーザーズ開始">
      <div className="cer-layer li-scene" style={{ background: 'radial-gradient(circle at 50% 40%, #1e3a5f 0%, #05070d 70%)' }} />
      <div className="cer-vignette" />
      <h2 className="cer-text cer-gold li-title" style={{ top: 360, fontSize: 120, letterSpacing: '0.12em' }}>
        LOSERS
      </h2>
      <p className="cer-text li-sub" style={{ top: 520, fontSize: 36, letterSpacing: '0.35em' }}>
        ルーザーズブラケット
      </p>
    </CeremonyFrame>
  );
}
