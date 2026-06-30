import { describe, expect, it, vi } from 'vitest';
import { effectTotalDuration, EFFECT_TIMING } from './effectConstants';
import { buildAdvanceTimeline, buildPresentationTimeline, buildWinnerTimeline } from './timeline';

describe('effectConstants', () => {
  it('勝利のみ ≈ 5.8 秒', () => {
    expect(effectTotalDuration(false)).toBeCloseTo(5.8, 1);
  });

  it('フル演出 ≈ 20 秒', () => {
    const total = effectTotalDuration(true);
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(24);
  });

  it('予感 + 炎の合計が従来の爆発尺', () => {
    expect(EFFECT_TIMING.vsAnticipation + EFFECT_TIMING.vsFlameBurst).toBeCloseTo(2.2, 1);
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

  it('フル演出 — 予感 → 炎 → VS', () => {
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
        onVsAnticipation: () => calls.push('anticipation'),
        onVsFlameBurst: () => calls.push('flame'),
        onVsShow: () => calls.push('vs'),
        onClose: () => calls.push('close'),
      },
      () => calls.push('complete'),
    );

    tl.progress(1);
    expect(calls).toContain('anticipation');
    expect(calls).toContain('flame');
    expect(calls.indexOf('anticipation')).toBeLessThan(calls.indexOf('flame'));
    expect(calls.indexOf('flame')).toBeLessThan(calls.indexOf('vs'));
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
  it('予感 → 炎 → VS の順', () => {
    const calls: string[] = [];
    const tl = buildAdvanceTimeline({
      onDimStart: () => calls.push('dim'),
      onLinesStart: () => calls.push('lines'),
      onLineProgress: () => {},
      onClashStart: () => calls.push('clash'),
      onCollision: () => calls.push('collision'),
      onVsAnticipation: () => calls.push('anticipation'),
      onVsFlameBurst: () => calls.push('flame'),
      onVsShow: () => calls.push('vs'),
      onClose: () => calls.push('close'),
    });
    tl.progress(1);
    expect(calls).toEqual([
      'dim',
      'lines',
      'clash',
      'collision',
      'anticipation',
      'flame',
      'vs',
      'close',
    ]);
    tl.kill();
  });
});
