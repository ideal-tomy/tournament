import type { RefObject } from 'react';
import gsap from 'gsap';
import type { EffectTiming } from './effectConstants';

/** 常時 mount された各レイヤーの ref オブジェクト */
export type StageRefObjects = {
  winner: RefObject<HTMLElement | null>;
  bar: RefObject<SVGGElement | null>;
  left: RefObject<HTMLElement | null>;
  right: RefObject<HTMLElement | null>;
  vs: RefObject<HTMLElement | null>;
  teamBackdrop: RefObject<HTMLElement | null>;
  clashLabels: RefObject<HTMLElement | null>;
  explosionWrap: RefObject<HTMLElement | null>;
  explosionVideo: RefObject<HTMLVideoElement | null>;
  spark: RefObject<HTMLElement | null>;
  flash: RefObject<HTMLElement | null>;
  bracketUpdated: RefObject<HTMLElement | null>;
  bracketFrozen: RefObject<HTMLElement | null>;
};

type ResolvedRefs = {
  winner: HTMLElement | null;
  bar: SVGGElement | null;
  left: HTMLElement | null;
  right: HTMLElement | null;
  vs: HTMLElement | null;
  teamBackdrop: HTMLElement | null;
  clashLabels: HTMLElement | null;
  explosionWrap: HTMLElement | null;
  explosionVideo: HTMLVideoElement | null;
  spark: HTMLElement | null;
  flash: HTMLElement | null;
  bracketUpdated: HTMLElement | null;
  bracketFrozen: HTMLElement | null;
};

function resolveRefs(r: StageRefObjects): ResolvedRefs {
  return {
    winner: r.winner.current,
    bar: r.bar.current,
    left: r.left.current,
    right: r.right.current,
    vs: r.vs.current,
    teamBackdrop: r.teamBackdrop.current,
    clashLabels: r.clashLabels.current,
    explosionWrap: r.explosionWrap.current,
    explosionVideo: r.explosionVideo.current,
    spark: r.spark.current,
    flash: r.flash.current,
    bracketUpdated: r.bracketUpdated.current,
    bracketFrozen: r.bracketFrozen.current,
  };
}

function setInitialState(r: ResolvedRefs): void {
  gsap.set(
    [r.winner, r.left, r.right, r.vs, r.explosionWrap, r.spark, r.flash, r.bracketUpdated, r.teamBackdrop, r.clashLabels],
    { opacity: 0 },
  );
  gsap.set(r.bracketFrozen, { opacity: 1 });
  if (r.bar) {
    gsap.set(r.bar, { scaleY: 0, transformOrigin: '50% 100%', transformBox: 'fill-box' });
  }
  gsap.set(r.left, { xPercent: -120, opacity: 0 });
  gsap.set(r.right, { xPercent: 120, opacity: 0 });
  gsap.set(r.vs, { scale: 0.85, opacity: 0 });
  gsap.set(r.explosionWrap, { scale: 0.92 });
}

export function buildMatchTimeline(
  refObjects: StageRefObjects,
  T: EffectTiming,
  opts: { advance: boolean; fireExplosion: () => void },
): gsap.core.Timeline {
  const r = resolveRefs(refObjects);
  setInitialState(r);

  const tl = gsap.timeline();

  tl.addLabel('win', 0)
    .to(r.winner, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 'win')
    .to(r.winner, { opacity: 0, duration: T.dissolve, ease: 'power1.inOut' }, `win+=${T.win}`);

  if (!opts.advance) {
    tl.addLabel('return', `win+=${T.win + T.dissolve}`)
      .to(r.bracketUpdated, { opacity: 1, duration: T.return, ease: 'power1.inOut' }, 'return')
      .to(r.bracketFrozen, { opacity: 0, duration: T.return, ease: 'power1.inOut' }, 'return');
    return tl;
  }

  const barAt = T.win + T.dissolve + T.pause;
  tl.fromTo(
    r.bar,
    { scaleY: 0 },
    { scaleY: 1, duration: T.barRise, ease: 'power2.out' },
    barAt,
  );

  const clashAt = barAt + T.barRise * 0.55;
  tl.addLabel('clash', clashAt)
    .to(r.teamBackdrop, { opacity: 1, duration: 0.35, ease: 'power2.out' }, 'clash')
    .to(r.clashLabels, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 'clash')
    .fromTo(
      r.left,
      { xPercent: -120, opacity: 0 },
      { xPercent: -18, opacity: 1, duration: T.clash, ease: 'power3.out' },
      'clash',
    )
    .fromTo(
      r.right,
      { xPercent: 120, opacity: 0 },
      { xPercent: 18, opacity: 1, duration: T.clash, ease: 'power3.out' },
      'clash',
    );

  const explosionFadeAt = T.impact - 0.5;

  tl.addLabel('impact', `clash+=${T.clash}`)
    .to([r.left, r.right], { xPercent: 0, duration: 0.35, ease: 'power4.in' }, 'impact')
    .fromTo(
      r.explosionWrap,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' },
      'impact',
    )
    .call(opts.fireExplosion, [], 'impact')
    .fromTo(r.spark, { opacity: 0 }, { opacity: 0.9, duration: 0.15, yoyo: true, repeat: 1 }, 'impact')
    .to([r.left, r.right, r.clashLabels], { opacity: 0.15, duration: 0.4, ease: 'power1.in' }, 'impact+=0.15')
    .to(r.explosionWrap, { opacity: 0, duration: 0.5, ease: 'power2.in' }, `impact+=${explosionFadeAt}`);

  tl.addLabel('hold', `impact+=${T.impact}`)
    .to([r.left, r.right, r.clashLabels], { opacity: 1, duration: 0.45, ease: 'power2.out' }, 'hold')
    .fromTo(
      r.vs,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' },
      'hold',
    )
    .to({}, { duration: T.vsHold });

  tl.addLabel('return', `hold+=${T.vsHold}`)
    .to(r.flash, { opacity: 1, duration: 0.2, ease: 'power2.in' }, 'return')
    .to(r.bracketUpdated, { opacity: 1, duration: T.return, ease: 'power1.inOut' }, 'return')
    .to([r.left, r.right, r.vs, r.teamBackdrop, r.clashLabels], { opacity: 0, duration: T.return * 0.7 }, 'return+=0.15')
    .to(r.bracketFrozen, { opacity: 0, duration: T.return, ease: 'power1.inOut' }, 'return')
    .to(r.flash, { opacity: 0, duration: T.return * 0.7 }, `return+=${T.return * 0.4}`);

  return tl;
}

export function skipTimeline(tl: gsap.core.Timeline): void {
  tl.eventCallback('onComplete', null);
  tl.kill();
}
