import { describe, expect, it } from 'vitest';
import { ADVANCE_CROSS_SPAN_SEC, ADVANCE_FADE_SEC, WINNER_ADVANCE_SEC, advanceCrossInAt } from './advanceTiming';

describe('advance crossfade', () => {
  it('starts the next layer when the current one has fallen to 70 percent', () => {
    expect(advanceCrossInAt(2)).toBeCloseTo(2 + ADVANCE_FADE_SEC * 0.3, 5);
    expect(ADVANCE_CROSS_SPAN_SEC).toBeCloseTo(ADVANCE_FADE_SEC * 1.3, 5);
  });

  it('uses the original six-second winner advance', () => {
    expect(WINNER_ADVANCE_SEC).toBe(6);
  });
});
