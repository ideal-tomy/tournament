import { describe, expect, it } from 'vitest';
import { toStageData } from '../features/bracket/manager';
import { resolveResultAdvance } from '../features/bracket/resultAdvance';
import { buildVenueAdvances, buildVenueAdvancesToEnd } from './venueAdvance';

describe('表示確認の進行', () => {
  it('仮の20組で、勝者の進む線が連続して引ける', async () => {
    const teams = Array.from({ length: 20 }, (_, index) => `team-${index + 1}`);
    const steps = await buildVenueAdvances(teams);
    expect(steps.length).toBe(6);
    for (const step of steps) {
      const advance = resolveResultAdvance(toStageData(step.before), toStageData(step.after), step.matchId, step.winnerTeamId);
      expect(advance?.path.length).toBeGreaterThan(0);
      expect(advance?.targetMatchId).not.toBe(step.matchId);
    }
    expect(new Set(steps.map((step) => step.matchId)).size).toBe(steps.length);
  });

  it('ルーザーズの試合を4で切らず、最後のルーザーズ試合まで含む', async () => {
    const teams = Array.from({ length: 20 }, (_, index) => `team-${index + 1}`);
    const steps = await buildVenueAdvancesToEnd(teams);
    const losers = steps.filter((step) => step.kind === 'loser');
    expect(losers.length).toBeGreaterThan(4);
    const last = losers[losers.length - 1];
    expect(last).toBeTruthy();
    // 最終ルーザーズのあとに、同じ進行列でさらにルーザーズが続かない
    const afterLast = steps.slice(steps.findIndex((step) => step.matchId === last.matchId) + 1);
    expect(afterLast.every((step) => step.kind !== 'loser')).toBe(true);
    expect(last.label).toMatch(/ルーザーズ \d+回戦 · \d+\/\d+/);
  });
});
