import { describe, expect, it } from 'vitest';
import { toStageData } from '../features/bracket/manager';
import { resolveResultAdvance } from '../features/bracket/resultAdvance';
import { buildVenueAdvances } from './venueAdvance';

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
});