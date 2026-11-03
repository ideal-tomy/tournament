import gsap from 'gsap';
import type { PresentationMode } from '../../../types';

type Timeline = gsap.core.Timeline;
interface PostMatchTiming { advance: number; approach: number; impact: number; hold: number }

function layer(root: Element, variant: string, name: string) {
  return root.querySelector<HTMLElement>(`.pbd-${variant} .pbd-${name}`);
}
function targets(root: Element, selector: string) {
  return [...root.querySelectorAll<HTMLElement>(selector)];
}

export function calmMotion(mode: PresentationMode) {
  return mode === 'lite' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Ambient loops run outside the scene timeline so the backdrop keeps moving while the
 * timeline is paused on a hold (VS waiting for the operator, WIN, CHAMPION).
 * Call inside the stage's gsap.context so revert() stops them.
 */
export function startBackdropLoops(root: Element, mode: PresentationMode) {
  if (calmMotion(mode)) return;
  const loop = (selector: string, vars: gsap.TweenVars, from?: gsap.TweenVars) => {
    const found = targets(root, selector);
    if (!found.length) return;
    if (from) gsap.fromTo(found, from, vars);
    else gsap.to(found, vars);
  };
  loop('.pbd-drawTable .pbd-base-img', { scale: 1.04, duration: 20, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-match .pbd-base-img, .pbd-champion .pbd-base-img', { scale: 1.08, xPercent: 2, duration: 12, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-sparks-a', { rotation: 360, duration: 16, ease: 'none', repeat: -1 });
  loop('.pbd-sparks-b', { rotation: -360, duration: 24, ease: 'none', repeat: -1 });
  loop('.pbd-confetti-img', { yPercent: 0, duration: 3.6, ease: 'none', repeat: -1 }, { yPercent: -18 });
  loop('.pbd-spot-fill', { scale: 1.12, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-split-a', { opacity: 0.45, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-split-b', { opacity: 0.45, duration: 0.9, delay: 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-ring-img', { rotation: 360, duration: 9, ease: 'none', repeat: -1 });
  loop('.pbd-cloud-img', { scale: 1.12, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  loop('.pbd-debris-img', { rotation: 360, duration: 26, ease: 'none', repeat: -1 });
  const beat = targets(root, '.pbd-beat');
  if (beat.length) {
    gsap.timeline({ repeat: -1, repeatDelay: 0.55 })
      .to(beat, { scale: 1.16, duration: 0.12, ease: 'power2.out' })
      .to(beat, { scale: 1, duration: 0.38, ease: 'power2.in' });
  }
}

function burst(tl: Timeline, target: HTMLElement | null, at: number, peak: number, from = 0.3, to = 1.8) {
  if (!target) return;
  tl.fromTo(target, { autoAlpha: 0, scale: from }, { autoAlpha: peak, scale: (from + to) / 2, duration: 0.14, ease: 'expo.out', immediateRender: false }, at)
    .to(target, { autoAlpha: 0, scale: to, duration: 0.55, ease: 'power2.out' }, at + 0.14);
}
function shockwave(tl: Timeline, target: HTMLElement | null, at: number, scale = 2.4) {
  if (!target) return;
  tl.fromTo(target, { autoAlpha: 0.95, scale: 0.2 }, { autoAlpha: 0, scale, duration: 0.9, ease: 'expo.out', immediateRender: false }, at);
}

/** One pair reveal: the table darkens, the gold rings close in, the two cards meet in the circle, then a still hold. */
export function appendPairCelebration(tl: Timeline, root: Element, pairStage: Element, { at, hold, exit }: { at: number; hold: number; exit: number }) {
  const scrim = layer(root, 'pair', 'scrim');
  const rings = pairStage.querySelector('.pc-rings'), flare = pairStage.querySelector('.pc-flare');
  const cards = [...pairStage.querySelectorAll<HTMLElement>('.pc-card')];
  const teamNo = pairStage.querySelector('.pc-team-no'), title = pairStage.querySelector('.pc-title'), next = pairStage.querySelector('.pc-next');
  const entering = [rings, ...cards, teamNo, title, next].filter((element): element is Element => element != null);
  if (entering.length) tl.set(entering, { autoAlpha: 0 }, at);
  if (scrim) {
    tl.fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out', immediateRender: false }, at)
      .to(scrim, { autoAlpha: 0, duration: exit, ease: 'power2.inOut' }, at + hold);
  }
  if (rings) tl.fromTo(rings, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'expo.out', immediateRender: false }, at);
  if (flare) {
    tl.fromTo(flare, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1.1, duration: 0.16, ease: 'expo.out', immediateRender: false }, at + 0.55)
      .to(flare, { autoAlpha: 0, scale: 1.6, duration: 0.7, ease: 'power2.out' }, at + 0.71);
  }
  if (cards.length) {
    const centre = (cards.length - 1) / 2;
    tl.fromTo(cards, { autoAlpha: 0, scale: 0.85, x: index => (index - centre) * 420 }, { autoAlpha: 1, scale: 1, x: 0, duration: 0.7, ease: 'back.out(1.5)', stagger: 0.06, immediateRender: false }, at + 0.1);
  }
  if (title) tl.fromTo(title, { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out', immediateRender: false }, at + 0.55);
  if (teamNo) tl.fromTo(teamNo, { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false }, at + 0.75);
  if (next) tl.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: false }, at + 1.4);
}

/** WIN celebration → build-up → VS impact, aligned with postMatchTiming. */
export function appendPostMatchBackdrop(tl: Timeline, root: Element, t: PostMatchTiming) {
  const spot = layer(root, 'match', 'spot'), sparks = layer(root, 'match', 'sparks'), confetti = layer(root, 'match', 'confetti');
  const split = layer(root, 'match', 'split'), ring = layer(root, 'match', 'ring'), debris = layer(root, 'match', 'debris'), flash = layer(root, 'match', 'flash');
  const [streakA] = targets(root, '.pbd-match .pbd-streak-a'), [streakB] = targets(root, '.pbd-match .pbd-streak-b');
  if (!spot || !sparks || !confetti || !split || !ring || !debris || !flash || !streakA || !streakB) return;
  const build = t.impact - t.approach, settle = Math.max(0.2, t.hold - t.impact - 0.5);
  tl.set([spot, sparks, confetti], { autoAlpha: 1, xPercent: 0 }, 0)
    .fromTo(spot, { scale: 0.6 }, { scale: 1, duration: 1.4, ease: 'power3.out', immediateRender: false }, 0);
  burst(tl, flash, 0.1, 1, 0.4, 1.7);
  shockwave(tl, ring, 0.1, 2.6);
  tl.to(spot, { xPercent: -28, duration: 0.6, ease: 'power2.inOut' }, t.advance)
    .to([sparks, confetti], { autoAlpha: 0.25, duration: 0.6 }, t.advance)
    .fromTo(split, { autoAlpha: 0 }, { autoAlpha: 1, duration: t.approach - t.advance, ease: 'sine.in', immediateRender: false }, t.advance)
    .to(spot, { xPercent: -15, autoAlpha: 0.45, duration: build, ease: 'power2.inOut' }, t.approach)
    .to([sparks, confetti], { autoAlpha: 0, duration: 0.8 }, t.approach)
    .fromTo(streakA, { autoAlpha: 0, xPercent: -70 }, { autoAlpha: 1, xPercent: 0, duration: build, ease: 'power3.in', immediateRender: false }, t.approach)
    .fromTo(streakB, { autoAlpha: 0, xPercent: 70, scaleX: -1 }, { autoAlpha: 1, xPercent: 0, scaleX: -1, duration: build, ease: 'power3.in', immediateRender: false }, t.approach)
    .fromTo(ring, { autoAlpha: 0, scale: 0.35 }, { autoAlpha: 0.8, scale: 1, duration: build, ease: 'power2.in', immediateRender: false }, t.approach)
    .to(ring, { autoAlpha: 0, scale: 2.8, duration: 0.7, ease: 'expo.out' }, t.impact)
    .to([streakA, streakB], { autoAlpha: 0, duration: 0.3 }, t.impact + 0.05)
    .fromTo(debris, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1.18, duration: 0.45, ease: 'expo.out', immediateRender: false }, t.impact)
    .to(debris, { autoAlpha: 0.55, scale: 1, duration: settle, ease: 'sine.out' }, t.impact + 0.45)
    .to(split, { autoAlpha: 0.75, duration: settle, ease: 'sine.out' }, t.impact + 0.3);
  burst(tl, flash, t.impact, 1, 0.3, 2);
}

/** CHAMPION: double burst, then the strongest sparks/confetti hold. */
export function appendChampionBackdrop(tl: Timeline, root: Element, factor: number) {
  const spot = layer(root, 'champion', 'spot'), sparks = layer(root, 'champion', 'sparks'), confetti = layer(root, 'champion', 'confetti');
  const ring = layer(root, 'champion', 'ring'), flash = layer(root, 'champion', 'flash');
  if (!spot || !sparks || !confetti) return;
  tl.fromTo(spot, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 1.2 * factor, ease: 'power3.out', immediateRender: false }, 0)
    .fromTo(sparks, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1.05, duration: 1 * factor, ease: 'back.out(1.5)', immediateRender: false }, 0.5 * factor)
    .fromTo(confetti, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 * factor, immediateRender: false }, 0.6 * factor);
  burst(tl, flash, 0.4 * factor, 1, 0.3, 2);
  shockwave(tl, ring, 0.4 * factor, 3);
  shockwave(tl, ring, 1.1 * factor, 2.2);
}
