import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount } from './manager';
import { computeBracketLayout } from './layout';

const BRACKET_KINDS = ['winner', 'loser', 'grand_final'] as const;

function assertLayout(data: Awaited<ReturnType<typeof buildSnapshotForTeamCount>>) {
  const L = computeBracketLayout(data);
  expect(L.matches.length).toBeGreaterThan(0);
  expect(L.width).toBeGreaterThan(0);
  expect(L.height).toBeGreaterThan(0);

  for (const kind of BRACKET_KINDS) {
    if (kind === 'grand_final') {
      expect(L.matches.some((m) => m.bracket === 'grand_final')).toBe(true);
    }
  }

  const byBucket = new Map<string, typeof L.matches>();
  for (const m of L.matches) {
    const key = `${m.bracket}:${m.round}`;
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key)!.push(m);
  }

  for (const [, ms] of byBucket) {
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const a = ms[i].box;
        const b = ms[j].box;
        const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlapY).toBe(false);
      }
    }
  }

  for (const m of L.matches) {
    expect(m.center.x).toBeGreaterThanOrEqual(m.box.x);
    expect(m.center.x).toBeLessThanOrEqual(m.box.x + m.box.w);
    expect(m.center.y).toBeGreaterThanOrEqual(m.box.y);
    expect(m.center.y).toBeLessThanOrEqual(m.box.y + m.box.h);
    for (const s of m.slots) {
      expect(s.center.x).toBeGreaterThanOrEqual(s.rect.x);
      expect(s.center.x).toBeLessThanOrEqual(s.rect.x + s.rect.w);
      expect(s.center.y).toBeGreaterThanOrEqual(s.rect.y);
      expect(s.center.y).toBeLessThanOrEqual(s.rect.y + s.rect.h);
    }
  }

  for (const m of L.matches) {
    expect(m.box.x + m.box.w).toBeLessThanOrEqual(L.width);
    expect(m.box.y + m.box.h).toBeLessThanOrEqual(L.height);
  }
}

describe('computeBracketLayout', () => {
  it.each([4, 8, 16])('%i チームで WB/LB/GF を含むレイアウト', async (n) => {
    const data = await buildSnapshotForTeamCount(n);
    assertLayout(data);
  });
});
