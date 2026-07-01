import { describe, expect, it, vi } from 'vitest';
import { effectTotalDuration, TIMING } from './effectConstants';
import { buildMatchTimeline, type StageRefObjects } from './timeline';

function mockRef<T>(el: T | null = null) {
  return { current: el };
}

function mockEl() {
  return {
    opacity: 0,
    scaleY: 1,
    xPercent: 0,
    scale: 1,
    transformOrigin: '',
    transformBox: '',
  };
}

function createMockStageRefs(): StageRefObjects {
  return {
    winner: mockRef(mockEl()),
    bar: mockRef(mockEl()),
    left: mockRef(mockEl()),
    right: mockRef(mockEl()),
    vs: mockRef(mockEl()),
    clashLabels: mockRef(mockEl()),
    explosionWrap: mockRef(mockEl()),
    explosionVideo: mockRef(mockEl() as unknown as HTMLVideoElement),
    spark: mockRef(mockEl()),
    flash: mockRef(mockEl()),
    bracketUpdated: mockRef(mockEl()),
    bracketFrozen: mockRef(mockEl()),
  } as unknown as StageRefObjects;
}

describe('effectConstants', () => {
  it('勝利のみ ≈ 6.0 秒', () => {
    expect(effectTotalDuration(false)).toBeCloseTo(TIMING.win + TIMING.dissolve + TIMING.return, 1);
  });

  it('フル演出 ≈ 19.5 秒（爆発5秒込み）', () => {
    const total = effectTotalDuration(true);
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(21);
  });
});

describe('buildMatchTimeline', () => {
  it('勝利のみ — return ラベルで終了', () => {
    vi.useFakeTimers();
    const refs = createMockStageRefs();
    const fireExplosion = vi.fn();
    const tl = buildMatchTimeline(refs, TIMING, { advance: false, fireExplosion });
    tl.progress(1);
    expect(fireExplosion).not.toHaveBeenCalled();
    expect(tl.labels.return).toBeDefined();
    tl.kill();
    vi.useRealTimers();
  });

  it('フル演出 — 接近 → 衝突 → VS → 復帰の順', () => {
    vi.useFakeTimers();
    const refs = createMockStageRefs();
    const fireExplosion = vi.fn();
    const tl = buildMatchTimeline(refs, TIMING, { advance: true, fireExplosion });

    const clashTime = tl.labels.clash ?? 0;
    const impactTime = tl.labels.impact ?? 0;
    const holdTime = tl.labels.hold ?? 0;
    const returnTime = tl.labels.return ?? 0;

    expect(clashTime).toBeLessThan(impactTime);
    expect(impactTime).toBeLessThan(holdTime);
    expect(holdTime).toBeLessThan(returnTime);

    tl.progress(1);
    expect(fireExplosion).toHaveBeenCalledTimes(1);
    tl.kill();
    vi.useRealTimers();
  });
});
