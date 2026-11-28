import { describe, expect, it } from 'vitest';
import { ADVANCE_CROSS_SPAN_SEC, ADVANCE_FADE_SEC, WINNER_ADVANCE_SEC, advanceCrossInAt } from './advanceTiming';

describe('advance crossfade', () => {
  it('starts the next layer when the current one has fallen to 70 percent', () => {
    expect(advanceCrossInAt(2)).toBeCloseTo(2 + ADVANCE_FADE_SEC * 0.3, 5);
    expect(ADVANCE_CROSS_SPAN_SEC).toBeCloseTo(ADVANCE_FADE_SEC * 1.3, 5);
  });

  it('keeps the close-up on screen after it has fully arrived, then uses the same dissolve back out', () => {
    const lineEnd = 2;
    const hold = 1.1;
    const pullback = lineEnd + ADVANCE_CROSS_SPAN_SEC + hold;
    expect(WINNER_ADVANCE_SEC).toBeCloseTo(pullback + ADVANCE_CROSS_SPAN_SEC, 5);
    expect(WINNER_ADVANCE_SEC).toBeGreaterThan(6);
  });
});