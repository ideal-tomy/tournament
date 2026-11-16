import { describe, expect, it } from 'vitest';
import { bracketSize, mountainCount, placeTeamsInSlots } from './slotPlacement';

describe('slotPlacement', () => {
  it('pads to the next power of two', () => {
    expect(bracketSize(20)).toBe(32);
    expect(bracketSize(8)).toBe(8);
  });

  it('keeps fixed teams in separate mountains and fills the rest in order', () => {
    const teams = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const slots = placeTeamsInSlots(
      teams,
      [
        { teamId: 't0', mountain: 0 },
        { teamId: 't1', mountain: 1 },
        { teamId: 't2', mountain: 2 },
        { teamId: 't3', mountain: 3 },
      ],
      ['t7', 't6', 't5', 't4'],
    );
    expect(slots).toHaveLength(8);
    expect(slots[0]).toBe('t0');
    expect(slots[2]).toBe('t1');
    expect(slots[4]).toBe('t2');
    expect(slots[6]).toBe('t3');
    expect(new Set(slots.filter(Boolean)).size).toBe(8);
    expect(mountainCount(4)).toBe(4);
  });
});
