import { useEffect } from 'react';
import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';
import { flushPresentationCues, resumePresentationVoices, setPresentationAudioBlockedHandler, setPresentationVoiceHandler } from './playPresentationAudio';

/** 開始フェード、周回のクロスフェード、場面の切り替え。秒。 */
export const BED_FADE_IN_SEC = 0.8;
export const BED_LOOP_CROSSFADE_SEC = 3;
/** ペア曲は末尾が約5秒かけて落ちる。その無音を待たず、次の周回を5秒早く重ねる。 */
export const BED_PAIR_LOOP_CROSSFADE_SEC = 8;
export const BED_SCENE_CROSSFADE_SEC = 1.5;
const BED_VOLUME = 0.4;

export type BedTrack = 'opening' | 'pair' | 'ending';

const BED_URL: Record<BedTrack, string> = {
  opening: FX.audio.opening,
  pair: FX.audio.pair,
  /** No dedicated ending track yet; replace this URL when one is added. */
  ending: FX.audio.opening,
};

export function bedOverlapSec(duration: number, crossfade = BED_LOOP_CROSSFADE_SEC) {
  if (!Number.isFinite(duration) || duration <= 0) return crossfade;
  return Math.min(crossfade, Math.max(0.45, duration / 3));
}

type VenueReview = 'draw' | 'vs' | 'winner' | 'champion' | null;

/** 会場のBGM。ペア発表だけ別曲で、それ以外は待機と同じ音源をループし続ける。 */
export function resolveVenueBed(input: {
  review: VenueReview;
  scene?: string;
  hasSession: boolean;
  photoError: boolean;
}): BedTrack {
  const showingPair = input.hasSession && !input.photoError
    && (input.review === 'draw' || (input.review == null && input.scene === 'draw'));
  return showingPair ? 'pair' : 'opening';
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

/**
 * Two voices of the same track: near the end the next one starts from the top while
 * the current one fades, so the silence padded around an MP3 loop is never heard alone.
 */
class LoopingBed {
  private readonly voices: HTMLAudioElement[] = [];
  private readonly gain = new Map<HTMLAudioElement, number>();
  private current: HTMLAudioElement;
  private level = 0;
  private stopped = false;
  private audible = false;
  private crossing = false;
  private watch: number | null = null;
  private cancelLevel: (() => void) | null = null;
  private cancelCross: (() => void) | null = null;
  private cancelDuck: (() => void) | null = null;
  private duckGain = 1;
  private duckTimer: number | null = null;

  constructor(
    private readonly url: string,
    private readonly fadeSec: number,
    private readonly overlapSec: number,
    private readonly onPlaying: () => void,
    private readonly onBlocked: () => void,
  ) {
    this.current = this.voice();
    this.gain.set(this.current, 1);
    this.apply();
    this.kick();
  }

  unlockFromGesture() {
    this.kick();
  }

  /** アナウンスのあいだ、BGMを約4割まで下げる。 */
  duck(seconds: number) {
    if (this.stopped) return;
    this.cancelDuck?.();
    this.cancelDuck = null;
    this.duckGain = 0.42;
    this.apply();
    if (this.duckTimer != null) window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      this.duckTimer = null;
      const from = this.duckGain;
      this.cancelDuck = animateVolume((amount) => {
        this.duckGain = from + (1 - from) * amount;
        this.apply();
      }, 0.5, () => { this.cancelDuck = null; });
    }, Math.max(0.2, seconds) * 1000);
  }

  fadeOut(seconds: number) {
    if (this.stopped) return;
    this.stopped = true;
    if (this.watch != null) window.clearInterval(this.watch);
    this.cancelLevel?.();
    const from = this.level;
    this.cancelLevel = animateVolume((amount) => {
      this.level = from * Math.cos(amount * Math.PI / 2);
      this.apply();
    }, seconds, () => {
      this.cancelCross?.();
      for (const voice of this.voices) voice.pause();
    });
  }

  private voice() {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 0;
    audio.src = this.url;
    audio.addEventListener('ended', () => {
      if (audio === this.current && !this.stopped) this.cross(0);
    });
    this.voices.push(audio);
    return audio;
  }

  private apply() {
    for (const voice of this.voices) setVolume(voice, BED_VOLUME * this.duckGain * this.level * (this.gain.get(voice) ?? 0));
  }

  private readonly tick = () => {
    if (this.stopped || this.crossing) return;
    const { duration, currentTime } = this.current;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const overlap = bedOverlapSec(duration, this.overlapSec);
    if (currentTime >= duration - overlap) this.cross(overlap);
  };

  private cross(seconds: number) {
    if (this.crossing) return;
    this.crossing = true;
    const from = this.current;
    const to = this.voices.find((voice) => voice !== from && voice.paused) ?? this.voice();
    to.currentTime = 0;
    this.gain.set(to, 0);
    this.current = to;
    void to.play().catch(() => undefined);
    this.cancelCross = animateVolume((amount) => {
      this.gain.set(from, Math.cos(amount * Math.PI / 2));
      this.gain.set(to, Math.sin(amount * Math.PI / 2));
      this.apply();
    }, seconds, () => {
      from.pause();
      this.gain.set(from, 0);
      this.apply();
      this.crossing = false;
      this.cancelCross = null;
    });
  }

  private kick() {
    if (this.stopped) return;
    void this.current.play().then(() => {
      if (this.stopped) {
        this.current.pause();
        return;
      }
      this.markAudible();
    }).catch(() => this.onBlocked());
  }

  private markAudible() {
    this.onPlaying();
    if (this.audible || this.stopped) return;
    this.audible = true;
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') this.watch = window.setInterval(this.tick, 200);
    this.cancelLevel = animateVolume((amount) => {
      this.level = Math.sin(amount * Math.PI / 2);
      this.apply();
    }, this.fadeSec);
  }
}

let current: BedTrack | null = null;
let active: LoopingBed | null = null;
let retiring: LoopingBed | null = null;
let gestureNeeded = false;
let gestureBound = false;
const listeners = new Set<(needsGesture: boolean) => void>();
const warmed: HTMLAudioElement[] = [];
const warmedUrls = new Set<string>();
const resumeFromGesture = () => {
  resumePresentationVoices();
  unlockPresentationBed();
};

let voiceGestureBound = false;
function bindVoiceGesture() {
  if (voiceGestureBound || typeof window === 'undefined') return;
  voiceGestureBound = true;
  window.addEventListener('pointerdown', () => resumePresentationVoices());
}

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

function retire(previous: LoopingBed | null) {
  if (!previous || previous === retiring) return;
  retiring?.fadeOut(0);
  retiring = previous;
}

export function setPresentationBed(next: BedTrack | null) {
  if (next === current && (next == null || active)) return;
  const previous = active;
  current = next;
  if (!next) {
    previous?.fadeOut(BED_SCENE_CROSSFADE_SEC);
    retiring?.fadeOut(BED_SCENE_CROSSFADE_SEC);
    active = null;
    retiring = null;
    setGestureNeeded(false);
    return;
  }
  bindGesture();
  retire(previous);
  const created = new LoopingBed(
    BED_URL[next],
    previous ? BED_SCENE_CROSSFADE_SEC : BED_FADE_IN_SEC,
    next === 'pair' ? BED_PAIR_LOOP_CROSSFADE_SEC : BED_LOOP_CROSSFADE_SEC,
    () => {
      if (active !== created) return;
      retiring?.fadeOut(BED_SCENE_CROSSFADE_SEC);
      retiring = null;
      setGestureNeeded(false);
      unbindGesture();
      if (next === 'opening' && typeof window.setTimeout === 'function') {
        window.setTimeout(() => warm(BED_URL.pair), 8000);
      }
    },
    () => {
      if (active === created) setGestureNeeded(true);
    },
  );
  active = created;
}

export function duckPresentationBed(seconds: number) {
  active?.duck(seconds);
  retiring?.duck(seconds);
}

export function unlockPresentationBed() {
  resumePresentationVoices();
  active?.unlockFromGesture();
  flushPresentationCues();
}

setPresentationAudioBlockedHandler(() => {
  bindGesture();
  bindVoiceGesture();
  setGestureNeeded(true);
});
setPresentationVoiceHandler(duckPresentationBed);
bindVoiceGesture();

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
