import { describe, expect, it } from 'vitest';
import { confirmLocalResult, currentLocalTeams, drawLocalTournament, emptyLocalTournament, samplePlayers, undoLocalResult } from './localTournament';

describe('local rehearsal without database', () => {
  for (const count of [8, 16, 32] as const) {
    for (const slot of [0, 1] as const) {
      it(`${count} players, winner slot ${slot}: complete including grand final reset`, async () => {
        let state = await drawLocalTournament({ ...emptyLocalTournament(), players: samplePlayers(count) });
        const original = JSON.stringify(state.snapshot);
        let games = 0;
        while (!state.champion && games < 100) {
          expect(currentLocalTeams(state)).toHaveLength(2);
          state = await confirmLocalResult({ ...state, phase: 'live' }, slot);
          if (games === 0) {
            expect(JSON.stringify(undoLocalResult(state).snapshot)).toBe(original);
          }
          games++;
        }
        expect(state.phase).toBe('finished');
        expect(state.teams.some(t => t.id === state.champion)).toBe(true);
        expect(games).toBeGreaterThanOrEqual(state.teams.length * 2 - 2);
        expect(games).toBeLessThanOrEqual(state.teams.length * 2 - 1);
      });
    }
  }
  it('does not accept results before manual start', async () => {
    const state = await drawLocalTournament({ ...emptyLocalTournament(), players: samplePlayers(8) });
    await expect(confirmLocalResult(state, 0)).rejects.toThrow('試合開始');
  });
});
