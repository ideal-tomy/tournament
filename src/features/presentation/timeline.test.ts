import { describe, expect, it, vi } from 'vitest';
import { effectTotalDuration, EFFECT_TIMING } from './effectConstants';
import { buildMatchTimeline } from './timeline';

describe('effectConstants', () => {
  it('合計尺が 6〜10 秒', () => {
    const total = effectTotalDuration();
    expect(total).toBeGreaterThanOrEqual(6);
    expect(total).toBeLessThanOrEqual(10);
  });

  it('各ステップが正の値', () => {
    for (const v of Object.values(EFFECT_TIMING)) {
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('buildMatchTimeline', () => {
  it('全コールバックが順に呼ばれる', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const tl = buildMatchTimeline({
      onDimStart: () => calls.push('dim'),
      onLinesStart: () => calls.push('lines'),
      onLineProgress: () => {},
      onCollision: () => calls.push('collision'),
      onExplosion: () => calls.push('explosion'),
      onVsShow: () => calls.push('vs'),
      onClose: () => calls.push('close'),
      onComplete: () => calls.push('complete'),
    });

    tl.progress(1);
    expect(calls).toEqual([
      'dim',
      'lines',
      'collision',
      'explosion',
      'vs',
      'close',
      'complete',
    ]);
    tl.kill();
    vi.useRealTimers();
  });
});
