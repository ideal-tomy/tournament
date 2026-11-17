import { describe, expect, it } from 'vitest';
import { PAIR_PLATE_HEIGHT, PAIR_PLATE_WIDTH, plateMetrics } from './VenueTeamNameplate';

describe('plateMetrics', () => {
  it('keeps the pair recipe at full width', () => {
    const m = plateMetrics(PAIR_PLATE_WIDTH);
    expect(m.width).toBe(1180);
    expect(m.height).toBeCloseTo(PAIR_PLATE_HEIGHT, 5);
    expect(m.textTop).toBeCloseTo(170, 5);
    expect(m.textSide).toBeCloseTo(180, 5);
    expect(m.fontSize).toBeCloseTo(72, 5);
  });

  it('scales text with the plate width', () => {
    const m = plateMetrics(590);
    expect(m.height).toBeCloseTo(PAIR_PLATE_HEIGHT / 2, 5);
    expect(m.textTop).toBeCloseTo(85, 5);
    expect(m.textSide).toBeCloseTo(90, 5);
    expect(m.fontSize).toBeCloseTo(36, 5);
  });
});
