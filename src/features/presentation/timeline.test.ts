import { describe, expect, it, vi } from 'vitest';
import { effectTotalDuration, EFFECT_TIMING } from './effectConstants';
import { buildAdvanceTimeline, buildPresentationTimeline, buildWinnerTimeline } from './timeline';

describe('effectConstants', () => {
  it('勝利のみ ≈ 2.6 秒', () => {
    expect(effectTotalDuration(false)).toBeCloseTo(2.6, 1);
  });

  it('フル演出 ≈ 10 秒', () => {
    const total = effectTotalDuration(true);
    expect(total).toBeGreaterThanOrEqual(9);
    expect(total).toBeLessThanOrEqual(12);
  });

  it('各ステップが正の値', () => {
    for (const v of Object.values(EFFECT_TIMING)) {
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('buildPresentationTimeline', () => {
  it('勝利演出のみ — show / close / complete', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const tl = buildPresentationTimeline(
      false,
      {
        onShow: () => calls.push('winner'),
        onClose: () => calls.push('winnerClose'),
      },
      undefined,
      () => calls.push('complete'),
    );

    tl.progress(1);
    expect(calls).toEqual(['winner', 'winnerClose', 'complete']);
    tl.kill();
    vi.useRealTimers();
  });

  it('フル演出 — 衝突までのコールバック', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const tl = buildPresentationTimeline(
      true,
      {
        onShow: () => calls.push('winner'),
        onClose: () => calls.push('winnerClose'),
      },
      {
        onDimStart: () => calls.push('dim'),
        onLinesStart: () => calls.push('lines'),
        onLineProgress: () => {},
        onClashStart: () => calls.push('clash'),
        onCollision: () => calls.push('collision'),
        onExplosion: () => calls.push('explosion'),
        onVsShow: () => calls.push('vs'),
        onClose: () => calls.push('close'),
      },
      () => calls.push('complete'),
    );

    tl.progress(1);
    expect(calls).toContain('winner');
    expect(calls).toContain('clash');
    expect(calls).toContain('collision');
    expect(calls).toContain('vs');
    expect(calls).toContain('complete');
    tl.kill();
    vi.useRealTimers();
  });
});

describe('buildWinnerTimeline', () => {
  it('onShow → onClose の順', () => {
    const calls: string[] = [];
    const tl = buildWinnerTimeline({
      onShow: () => calls.push('show'),
      onClose: () => calls.push('close'),
    });
    tl.progress(1);
    expect(calls).toEqual(['show', 'close']);
    tl.kill();
  });
});

describe('buildAdvanceTimeline', () => {
  it('clash を含む', () => {
    const calls: string[] = [];
    const tl = buildAdvanceTimeline({
      onDimStart: () => calls.push('dim'),
      onLinesStart: () => calls.push('lines'),
      onLineProgress: () => {},
      onClashStart: () => calls.push('clash'),
      onCollision: () => calls.push('collision'),
      onExplosion: () => calls.push('explosion'),
      onVsShow: () => calls.push('vs'),
      onClose: () => calls.push('close'),
    });
    tl.progress(1);
    expect(calls).toEqual(['dim', 'lines', 'clash', 'collision', 'explosion', 'vs', 'close']);
    tl.kill();
  });
});
