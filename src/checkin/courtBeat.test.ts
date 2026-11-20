import { describe, expect, it } from 'vitest';
import type { CourtSpotlight, DrawState } from './DrawControl';
import { courtBeat } from './useTournamentState';

function state(spot: Partial<CourtSpotlight> | null): DrawState {
  const spotlight = spot
    ? {
        id: 'beat',
        kind: 'losers-intro' as const,
        board: 0,
        elapsed: 0,
        winnerSec: 9,
        winnerTeamId: null,
        loserTeamId: null,
        resultPresentation: null,
        match: { id: 1 },
        ...spot,
      }
    : null;
  return { flow: { courts: { boards: [], spotlight } } } as unknown as DrawState;
}

describe('courtBeat', () => {
  it('ルーザーズ告知は5秒で表へ切り替える', () => {
    expect(courtBeat(state({ elapsed: 4.9 }))).toContain('beat:losers-intro');
    expect(courtBeat(state({ elapsed: 5 }))).toContain('beat:bracket');
  });

  it('隣の台が動いていても、勝者演出のあと表の段階に進む', () => {
    expect(courtBeat(state({ kind: 'winner', elapsed: 8, winnerSec: 9 }))).toContain('beat:winner');
    expect(courtBeat(state({ kind: 'winner', elapsed: 9, winnerSec: 9 }))).toContain('beat:bracket');
  });
});
