import { afterEach, describe, expect, it, vi } from 'vitest';
import { bedOverlapSec, BED_LOOP_CROSSFADE_SEC, resolveVenueBed, setPresentationBed } from './presentationBed';

const idle = { review: null, scene: 'idle', hasSession: true, photoError: false } as const;

describe('resolveVenueBed', () => {
  it('plays opening until the match, and pair only on the draw', () => {
    expect(resolveVenueBed({ ...idle, hasSession: false, scene: undefined })).toBe('opening');
    expect(resolveVenueBed(idle)).toBe('opening');
    expect(resolveVenueBed({ ...idle, scene: 'draw' })).toBe('pair');
    expect(resolveVenueBed({ ...idle, scene: 'bracket' })).toBe('opening');
    expect(resolveVenueBed({ ...idle, scene: 'vs_card' })).toBe('opening');
    expect(resolveVenueBed({ ...idle, scene: 'match_live' })).toBeNull();
    expect(resolveVenueBed({ ...idle, scene: 'result' })).toBeNull();
    expect(resolveVenueBed({ ...idle, scene: 'award' })).toBeNull();
    expect(resolveVenueBed({ ...idle, scene: 'finished' })).toBeNull();
  });

  it('follows a read-only review only when that stage is on screen', () => {
    expect(resolveVenueBed({ ...idle, review: 'draw' })).toBe('pair');
    expect(resolveVenueBed({ ...idle, review: 'vs', scene: 'idle' })).toBe('opening');
    expect(resolveVenueBed({ ...idle, review: 'winner' })).toBeNull();
    expect(resolveVenueBed({ ...idle, review: 'champion' })).toBeNull();
    expect(resolveVenueBed({ ...idle, review: 'draw', hasSession: false })).toBe('opening');
    expect(resolveVenueBed({ ...idle, scene: 'draw', photoError: true })).toBeNull();
  });
});

describe('bedOverlapSec', () => {
  it('crossfades three seconds on a long track and shortens the overlap on a short one', () => {
    expect(bedOverlapSec(180)).toBe(BED_LOOP_CROSSFADE_SEC);
    expect(bedOverlapSec(6)).toBe(2);
    expect(bedOverlapSec(1.2)).toBeCloseTo(0.45);
    expect(bedOverlapSec(Number.NaN)).toBe(BED_LOOP_CROSSFADE_SEC);
  });
});

class FakeAudio {
  src = '';
  preload = '';
  loop = false;
  paused = true;
  currentTime = 0;
  duration = 10;
  private storedVolume = 1;
  get volume() {
    return this.storedVolume;
  }
  set volume(value: number) {
    if (value < 0 || value > 1 || Number.isNaN(value)) {
      throw new DOMException(`The volume provided (${value}) is outside the range [0, 1].`, 'IndexSizeError');
    }
    this.storedVolume = value;
  }
  private listeners = new Map<string, Set<(event: Event) => void>>();
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    const group = this.listeners.get(type) ?? new Set();
    group.add(listener);
    this.listeners.set(type, group);
  }
  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }
}

describe('setPresentationBed', () => {
  const audios: FakeAudio[] = [];
  let watch: (() => void) | null = null;
  let now = 0;

  afterEach(() => {
    setPresentationBed(null);
    audios.length = 0;
    watch = null;
    now = 0;
    vi.unstubAllGlobals();
  });

  it('fades in, keeps looping, and fades out when the stage ends', async () => {
    vi.stubGlobal('Audio', class {
      constructor() {
        const audio = new FakeAudio();
        audios.push(audio);
        return audio;
      }
    });
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      now += 400;
      callback(now);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('window', {
      setInterval: (callback: () => void) => {
        watch = callback;
        return 1;
      },
      clearInterval: () => {
        watch = null;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });

    setPresentationBed('opening');
    await Promise.resolve();
    expect(audios).toHaveLength(1);
    expect(audios[0].loop).toBe(true);
    expect(audios[0].src).toContain(encodeURIComponent('オープニング.mp3'));
    expect(audios[0].paused).toBe(false);
    expect(audios[0].volume).toBeCloseTo(0.4);

    audios[0].currentTime = 8;
    watch?.();
    expect(audios[0].paused).toBe(false);
    expect(audios[0].loop).toBe(true);

    setPresentationBed('pair');
    await Promise.resolve();
    const pair = audios.filter((audio) => audio.src.includes(encodeURIComponent('ペア.mp3')) && !audio.paused);
    expect(pair).toHaveLength(1);
    expect(pair[0].volume).toBeCloseTo(0.4);
    expect(audios[0].paused).toBe(true);
    expect(pair[0].loop).toBe(true);

    setPresentationBed(null);
    expect(audios.every((audio) => audio.paused)).toBe(true);
  });

  it('keeps fading in when the first frame is timestamped before the fade starts', async () => {
    let clock = 5000;
    let frames = 0;
    vi.stubGlobal('Audio', class {
      constructor() {
        const audio = new FakeAudio();
        audios.push(audio);
        return audio;
      }
    });
    vi.stubGlobal('performance', { now: () => clock });
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames += 1;
      if (frames === 1) callback(clock - 8);
      else {
        clock += 500;
        callback(clock);
      }
      return frames;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('window', {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });

    setPresentationBed('opening');
    await Promise.resolve();
    const playing = audios.find((audio) => !audio.paused);
    expect(playing?.loop).toBe(true);
    expect(playing?.volume).toBeCloseTo(0.4);
    expect(playing?.volume).toBeGreaterThanOrEqual(0);
  });
});