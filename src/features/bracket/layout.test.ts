import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount, toStageData } from './manager';
import { computeBracketLayout } from './layout';

const BRACKET_KINDS = ['winner', 'loser', 'grand_final'] as const;

function assertLayout(data: Awaited<ReturnType<typeof buildSnapshotForTeamCount>>) {
  const L = computeBracketLayout(toStageData(data));
  expect(L.matches.length).toBeGreaterThan(0);
  expect(L.width).toBeGreaterThan(0);
  expect(L.height).toBeGreaterThan(0);

  for (const kind of BRACKET_KINDS) {
    if (kind === 'grand_final') {
      // GF は参加者確定後に表示（初期は非表示）
      continue;
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
        const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
        expect(overlapX).toBe(false);
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

describe('drop connectors', () => {
  it('初期状態では drop 線は非表示（Losers 参加者確定後に表示）', async () => {
    const data = await buildSnapshotForTeamCount(8);
    const L = computeBracketLayout(toStageData(data));
    const drops = L.connectors.filter((c) => c.kind === 'drop');
    expect(drops.length).toBe(0);
  });

  it('6 チームで advance 線は存在', async () => {
    const data = await buildSnapshotForTeamCount(6);
    const L = computeBracketLayout(toStageData(data));
    expect(L.connectors.some((c) => c.kind === 'advance')).toBe(true);
  });

  it('下位ラウンドほど Y が大きい（下→上）', async () => {
    const data = await buildSnapshotForTeamCount(8);
    const L = computeBracketLayout(toStageData(data));
    const wb = L.matches.filter((m) => m.bracket === 'winner');
    const r1 = wb.filter((m) => m.round === 1);
    const r2 = wb.filter((m) => m.round === 2);
    if (r1.length && r2.length) {
      const avg = (ms: typeof r1) => ms.reduce((s, m) => s + m.box.y, 0) / ms.length;
      expect(avg(r1)).toBeGreaterThan(avg(r2));
    }
  });
});

describe('bracketTheme', () => {
  it('WB/LB/GF テーマが定義されている', async () => {
    const { bracketTheme, themeForBracket } = await import('../../styles/bracketTheme');
    expect(bracketTheme.wb.label).toBe('WINNERS');
    expect(bracketTheme.lb.label).toBe('LOSERS');
    expect(bracketTheme.gf.label).toBe('GRAND FINAL');
    expect(themeForBracket('winner').stroke).toBeTruthy();
  });
});

describe('computeBracketLayout', () => {
  it.each([4, 8, 16])('%i チームで WB/LB/GF を含むレイアウト', async (n) => {
    const data = await buildSnapshotForTeamCount(n);
    assertLayout(data);
  });

  it('初期状態では Losers / GF を非表示（参加者が入るまで）', async () => {
    const data = await buildSnapshotForTeamCount(16);
    const L = computeBracketLayout(toStageData(data));
    expect(L.matches.filter((m) => m.bracket === 'winner').length).toBeGreaterThan(0);
    expect(L.matches.filter((m) => m.bracket === 'loser').length).toBe(0);
    expect(L.matches.filter((m) => m.bracket === 'grand_final').length).toBe(0);
    expect(L.connectors.filter((c) => c.kind === 'drop').length).toBe(0);
  });
});
