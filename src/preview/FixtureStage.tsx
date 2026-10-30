import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { StageControls } from '../features/presentation/postMatch/PostMatchStage';
import type { PresentationMode } from '../types';
import { TOURNAMENT_EFFECTS as FX } from '../lib/tournamentEffects';
import { drawSeconds } from '../features/presentation/drawAnimationTiming';
import type { sampleWinner } from './fixtures';

interface Props {
  eventLabel?: string;
  scene: 'draw' | 'champion';
  mode: PresentationMode;
  team: typeof sampleWinner;
  onProgress(time: number, playing: boolean): void;
}
export function fixtureDuration(scene: Props['scene'], mode: PresentationMode) {
  return (scene === 'draw' ? 7 : 5) * (mode === 'full' ? 1 : mode === 'short' ? .7 : .5);
}

/** Presentational renderer: receives team data; no persistence or scene API. */
const FixtureStage = forwardRef<StageControls, Props>(function FixtureStage({ scene, mode, team, onProgress, eventLabel = 'ANIMATION PREVIEW · SAMPLE ONLY' }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline>();
  useImperativeHandle(ref, () => ({
    play() { timeline.current?.play(); },
    pause() { const t = timeline.current; t?.pause(); if (t) onProgress(t.time(), false); },
    seek(time) { const t = timeline.current; t?.pause().seek(time, true); if (t) onProgress(t.time(), false); },
    skip() { const t = timeline.current; if (t) { t.pause().seek(t.duration(), true); onProgress(t.time(), false); } },
  }), [onProgress]);
  useLayoutEffect(() => {
    const f = mode === 'full' ? 1 : mode === 'short' ? .7 : .5;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, onUpdate: () => onProgress(tl.time(), !tl.paused() && tl.time() < tl.duration()), onComplete: () => onProgress(tl.duration(), false) });
      timeline.current = tl;
      if (scene === 'draw') {
        tl.set('.ap-confirm, .ap-front', { autoAlpha: 0 })
          .set('.ap-dart', { xPercent: -180, autoAlpha: 0 })
          .fromTo('.ap-card', { yPercent: mode === 'lite' ? 0 : 20, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: .2 * f, duration: drawSeconds('cardEnter') * f }, 0);
        if (mode !== 'lite') tl.to('.ap-dart', { xPercent: 0, autoAlpha: 1, duration: drawSeconds('dartFlight') * f, ease: 'power3.in' }, .6 * f)
          .to('.ap-dart', { autoAlpha: 0, duration: .2 * f }, 1.3 * f);
        tl.to('.ap-back', { rotationY: mode === 'lite' ? 0 : 90, autoAlpha: 0, stagger: .3 * f, duration: drawSeconds('cardFlip') * f }, 1.5 * f)
          .fromTo('.ap-front', { rotationY: mode === 'lite' ? 0 : -90, autoAlpha: 0 }, { rotationY: 0, autoAlpha: 1, stagger: .3 * f, duration: drawSeconds('playerReveal') * f }, 2.1 * f)
          .fromTo('.ap-confirm', { autoAlpha: 0, scale: .95 }, { autoAlpha: 1, scale: 1, duration: .5 * f }, 3.5 * f);
      } else {
        tl.fromTo('.ap-crown', { autoAlpha: 0, yPercent: mode === 'lite' ? 0 : -30, scale: .8 }, { autoAlpha: 1, yPercent: 0, scale: 1, duration: .8 * f }, 0)
          .fromTo('.ap-champion-title', { autoAlpha: 0, letterSpacing: '.25em' }, { autoAlpha: 1, letterSpacing: '.1em', duration: .8 * f }, .5 * f)
          .fromTo('.ap-champions', { autoAlpha: 0, scale: .9 }, { autoAlpha: 1, scale: 1, duration: .8 * f }, 1 * f);
        tl.fromTo('.ap-confetti', { autoAlpha: 0, yPercent: mode === 'lite' ? 0 : -12 }, { autoAlpha: mode === 'lite' ? .12 : .4, yPercent: 0, duration: 2 * f }, 0);
      }
      tl.to({}, { duration: fixtureDuration(scene, mode) }, 0);
    }, root);
    return () => { ctx.revert(); timeline.current = undefined; };
  }, [scene, mode, onProgress]);
  return <div ref={root} className={`pm-stage ap-fixture ap-${scene}`} aria-label={scene === 'draw' ? 'サンプル抽選演出' : 'サンプル優勝演出'}>
    <div className="pm-title">DARTS TOURNAMENT <span>{eventLabel}</span></div>
    {scene === 'draw' ? <>
      <h2 className="ap-draw-title">THE DRAW <small>TEAM 01</small></h2>
      <div className="ap-cards">{team.members.map((member, i) => <div className="ap-card" key={i}>
        <img className="ap-back" src={FX.cards.back} alt="抽選カード裏面" />
        <div className="ap-front"><img className="ap-card-frame" src={FX.cards.front} alt="" /><img className="ap-portrait" src={team.faces[i]} alt="" /><strong>{member}</strong></div>
      </div>)}</div>
      <img className="ap-dart" src={FX.darts.main} alt="" />
      <div className="ap-confirm">{team.members.length === 2 ? 'PAIR CONFIRMED' : 'PARTICIPANT CONFIRMED'} <small>{team.name}</small></div>
    </> : <>
      <img className="ap-confetti" src={FX.effects.celebrationConfetti} alt="" />
      <div className="ap-crown" aria-hidden="true">♛</div>
      <h2 className="ap-champion-title">CHAMPION</h2>
      <div className="ap-champions"><div>{team.members.map((member, i) => <figure key={i}><img src={team.faces[i]} alt="" /><figcaption>{member}</figcaption></figure>)}</div><strong>{team.name}</strong></div>
    </>}
  </div>;
});
export default FixtureStage;
