import { describe, expect, it } from 'vitest';
import { buildSnapshotForTeamCount, toStageData } from './manager';
import { computeBracketLayout, buildOrthogonalConnectorPath, visibleMatchIdsWhenOmitCompleted } from './layout';
import { buildVenueAdvances } from '../../checkin/venueAdvance';

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
  it.each([4, 8, 16, 20])('%i チームで WB/LB/GF を含むレイアウト', async (n) => {
    const data = await buildSnapshotForTeamCount(n);
    assertLayout(data);
  });

  it('初期状態でも Losers の枠と進線を出し、GF は参加者確定まで隠す', async () => {
    const data = await buildSnapshotForTeamCount(16);
    const L = computeBracketLayout(toStageData(data));
    expect(L.matches.filter((m) => m.bracket === 'winner').length).toBeGreaterThan(0);
    expect(L.matches.filter((m) => m.bracket === 'loser').length).toBeGreaterThan(0);
    expect(L.connectors.some((c) => c.kind === 'advance')).toBe(true);
    expect(L.matches.filter((m) => m.bracket === 'grand_final').length).toBe(0);
    expect(L.connectors.filter((c) => c.kind === 'drop').length).toBe(0);
  });

  it('コネクタは直角パス（縦→横→縦）', () => {
    const d = buildOrthogonalConnectorPath({ x: 10, y: 100 }, { x: 50, y: 40 });
    expect(d).toContain('V 70');
    expect(d).toContain('H 50');
    expect(d).not.toMatch(/L.*L.*L/);
  });

  it('ルーザーの段間はカードの高さに合わせる', async () => {
    const data = await buildSnapshotForTeamCount(8);
    const L = computeBracketLayout(toStageData(data), undefined, 'losers');
    const rounds = [2, 3].map((round) => L.matches.find((m) => m.bracket === 'loser' && m.round === round));
    const [lower, upper] = rounds;
    expect(lower && upper).toBeTruthy();
    if (!lower || !upper) return;
    expect(lower.box.y - (upper.box.y + upper.box.h)).toBeLessThanOrEqual(28);
  });

  it('不戦勝同士の初戦は一番下に置き、2段目を飛ばして次の段へつなぐ', async () => {
    const raw = await buildSnapshotForTeamCount(20);
    const data = toStageData(raw);
    const L = computeBracketLayout(data, undefined, 'winners');
    const winners = L.matches.filter((match) => match.bracket === 'winner');
    const bottom = winners.filter((match) => match.isLeafRound);
    const names = new Map(data.participant.map((person) => [person.id, person.name]));
    const teams = bottom.flatMap((match) => {
      const source = data.match.find((row) => row.id === match.matchId);
      return [source?.opponent1?.id, source?.opponent2?.id]
        .filter((id): id is number => id != null)
        .map((id) => names.get(id));
    });
    expect(new Set(teams).size).toBe(20);
    expect(bottom.every((match) => {
      const source = data.match.find((row) => row.id === match.matchId);
      return source?.opponent1?.id != null && source?.opponent2?.id != null;
    })).toBe(true);
    expect(new Set(bottom.map((match) => match.box.y)).size).toBe(1);

    const promoted = bottom.filter((match) => match.round === 2);
    const waiting = winners.filter((match) => match.round === 2 && !match.isLeafRound);
    expect(promoted).toHaveLength(6);
    expect(waiting).toHaveLength(2);
    expect(Math.max(...waiting.map((match) => match.box.y))).toBeLessThan(bottom[0].box.y);
    for (const card of promoted) {
      const link = L.connectors.find((connector) => connector.fromMatchId === card.matchId && connector.kind === 'advance');
      const target = link ? L.byId[link.toMatchId] : undefined;
      expect(target?.round).toBe(3);
      expect(target!.box.y).toBeLessThan(waiting[0].box.y);
    }
  });

  it('消化後のフォーカスレイアウトは縦余白を詰める', async () => {
    const teamIds = Array.from({ length: 20 }, (_, index) => `team-${index + 1}`);
    const steps = await buildVenueAdvances(teamIds, 10);
  expect(steps.length).toBeGreaterThan(3);
    const data = toStageData(steps[steps.length - 1].after);
    const full = computeBracketLayout(data, undefined, 'winners');
    const focusIds = visibleMatchIdsWhenOmitCompleted(data, 'winners');
    const focused = computeBracketLayout(data, undefined, 'winners', { visibleMatchIds: focusIds });
    expect(focused.matches.length).toBeLessThan(full.matches.length);
    expect(focused.height).toBeLessThan(full.height * 0.9);
  });

  it('2 回戦の試合は 1 回戦 2 試合の中央に配置される', async () => {
    const data = await buildSnapshotForTeamCount(16);
    const L = computeBracketLayout(toStageData(data));
    const wb = L.matches.filter((m) => m.bracket === 'winner');
    const r1 = wb.filter((m) => m.round === 1);
    const r2 = wb.filter((m) => m.round === 2);
    expect(r1.length).toBe(8);
    expect(r2.length).toBe(4);
    const m0 = r1.find((m) => m.row === 0)!;
    const m1 = r1.find((m) => m.row === 1)!;
    const parent = r2.find((m) => m.row === 0)!;
    expect(parent.center.x).toBeCloseTo((m0.center.x + m1.center.x) / 2, 0);
  });
});
