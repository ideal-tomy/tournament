import { useEffect } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';

/** 開始フェードと場面の切り替え。秒。周回は要素の loop に任せる。 */
export const BED_FADE_IN_SEC = 0.8;
export const BED_LOOP_CROSSFADE_SEC = 3;
export const BED_SCENE_CROSSFADE_SEC = 1.5;
const BED_VOLUME = 0.4;

export type BedTrack = 'opening' | 'pair';

const BED_URL: Record<BedTrack, string> = {
  opening: FX.audio.opening,
  pair: FX.audio.pair,
};

export function bedOverlapSec(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return BED_LOOP_CROSSFADE_SEC;
  return Math.min(BED_LOOP_CROSSFADE_SEC, Math.max(0.45, duration / 3));
}

type VenueReview = 'draw' | 'vs' | 'winner' | 'champion' | null;

/** 会場で今流す曲。試合中・結果・表彰は止める。 */
export function resolveVenueBed(input: {
  review: VenueReview;
  scene?: string;
  hasSession: boolean;
  photoError: boolean;
}): BedTrack | null {
  const reviewing = input.review !== null && input.hasSession && !input.photoError;
  if (reviewing && input.review === 'draw') return 'pair';
  if (reviewing && input.review === 'vs') return 'opening';
  if (reviewing) return null;
  if (!input.hasSession || !input.scene || input.scene === 'idle') return 'opening';
  if (input.scene === 'draw' && !input.photoError) return 'pair';
  if (input.scene === 'bracket' || input.scene === 'vs_card') return 'opening';
  return null;
}

function fadeAmount(now: number, start: number, seconds: number) {
  return Math.min(1, Math.max(0, (now - start) / (seconds * 1000)));
}

function setVolume(element: HTMLAudioElement, value: number) {
  element.volume = Math.min(1, Math.max(0, value));
}

function animateVolume(apply: (amount: number) => void, seconds: number, done?: () => void) {
  if (seconds <= 0) {
    apply(1);
    done?.();
    return () => undefined;
  }
  const start = performance.now();
  let frame = 0;
  let cancelled = false;
  const step = (now: number) => {
    if (cancelled) return;
    const amount = fadeAmount(now, start, seconds);
    apply(amount);
    if (amount < 1) frame = requestAnimationFrame(step);
    else done?.();
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

class LoopingBed {
  private readonly audio = new Audio();
  private stopped = false;
  private audible = false;
  private cancelFade: (() => void) | null = null;

  constructor(
    url: string,
    private readonly fadeSec: number,
    private readonly onPlaying: () => void,
    private readonly onBlocked: () => void,
  ) {
    this.audio.preload = 'auto';
    this.audio.loop = true;
    this.audio.volume = 0;
    this.audio.src = url;
    this.kick();
  }

  unlockFromGesture() {
    if (this.stopped) return;
    void this.audio.play().then(() => {
      if (this.stopped) {
        this.audio.pause();
        return;
      }
      this.markAudible();
    }).catch(() => this.onBlocked());
  }

  fadeOut(seconds: number) {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelFade?.();
    const from = this.audio.volume;
    this.cancelFade = animateVolume((amount) => {
      setVolume(this.audio, from * Math.cos(amount * Math.PI / 2));
    }, seconds, () => {
      this.audio.pause();
    });
  }

  private kick() {
    void this.audio.play().then(() => {
      if (this.stopped) {
        this.audio.pause();
        return;
      }
      this.markAudible();
    }).catch(() => this.onBlocked());
  }

  private markAudible() {
    this.onPlaying();
    if (this.audible || this.stopped) return;
    this.audible = true;
    this.cancelFade = animateVolume((amount) => {
      setVolume(this.audio, BED_VOLUME * Math.sin(amount * Math.PI / 2));
    }, this.fadeSec);
  }
}

let current: BedTrack | null = null;
let active: LoopingBed | null = null;
let gestureNeeded = false;
let gestureBound = false;
const listeners = new Set<(needsGesture: boolean) => void>();
const warmed: HTMLAudioElement[] = [];
const warmedUrls = new Set<string>();
const resumeFromGesture = () => unlockPresentationBed();

function setGestureNeeded(needed: boolean) {
  if (gestureNeeded === needed) return;
  gestureNeeded = needed;
  for (const listener of listeners) listener(needed);
}

function bindGesture() {
  if (gestureBound || typeof window === 'undefined') return;
  gestureBound = true;
  window.addEventListener('pointerdown', resumeFromGesture);
  window.addEventListener('keydown', resumeFromGesture);
}

function unbindGesture() {
  if (!gestureBound || typeof window === 'undefined') return;
  gestureBound = false;
  window.removeEventListener('pointerdown', resumeFromGesture);
  window.removeEventListener('keydown', resumeFromGesture);
}

export function isPresentationBedUrl(url: string) {
  return (Object.values(BED_URL) as string[]).includes(url);
}

function warm(url: string) {
  if (warmedUrls.has(url) || typeof Audio === 'undefined') return;
  warmedUrls.add(url);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  warmed.push(audio);
}

export function prefetchPresentationBeds() {
  warm(BED_URL.opening);
}

export function setPresentationBed(next: BedTrack | null) {
  if (next === current) return;
  const previous = active;
  current = next;
  if (previous) previous.fadeOut(BED_SCENE_CROSSFADE_SEC);
  if (!next) {
    active = null;
    setGestureNeeded(false);
    return;
  }
  bindGesture();
  const created = new LoopingBed(
    BED_URL[next],
    previous ? BED_SCENE_CROSSFADE_SEC : BED_FADE_IN_SEC,
    () => {
      if (active === created) {
        setGestureNeeded(false);
        unbindGesture();
        if (next === 'opening' && typeof window.setTimeout === 'function') {
          window.setTimeout(() => warm(BED_URL.pair), 8000);
        }
      }
    },
    () => {
      if (active === created) setGestureNeeded(true);
    },
  );
  active = created;
}

export function unlockPresentationBed() {
  active?.unlockFromGesture();
}

export function subscribePresentationBed(listener: (needsGesture: boolean) => void) {
  listeners.add(listener);
  listener(gestureNeeded);
  return () => {
    listeners.delete(listener);
  };
}

export function usePresentationBed(track: BedTrack | null, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    prefetchPresentationBeds();
    setPresentationBed(track);
  }, [track, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return () => setPresentationBed(null);
  }, [enabled]);
}
