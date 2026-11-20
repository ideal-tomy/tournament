import { describe, expect, it } from 'vitest';
import type { CourtBoard, DrawState } from './DrawControl';
import { firstBoardAutoFill } from './firstBoardAutoFill';

function board(patch: Partial<CourtBoard> = {}): CourtBoard {
  return { board: 1, matchId: null, stage: 'idle', startedAt: null, showing: false, match: null, ...patch };
}

function state(flow: Partial<NonNullable<DrawState['flow']>> = {}, first = board()): DrawState {
  return {
    scene: 'interval',
    version: 1,
    flow: {
      phase: 'interval',
      currentMatch: null,
      nextMatch: { id: 4, teamA: 'a', teamB: 'b' },
      losersIntroRemainingSec: 0,
      winnerTeamId: null,
      loserTeamId: null,
      championTeamId: null,
      lastMatchId: null,
      canGameStart: false,
      canAnnounce: false,
      canStart: false,
      canScore: false,
      canAdvance: false,
      completedMatches: 1,
      courts: { count: 2, showBracket: false, spotlight: null, boards: [first, { ...board(), board: 2 }] },
      ...flow,
    },
  } as DrawState;
}

describe('firstBoardAutoFill', () => {
  it('台1が空いていて次の試合があるときだけ入れる', () => {
    expect(firstBoardAutoFill(state())).toBe(true);
    expect(firstBoardAutoFill(state({ nextMatch: null }))).toBe(false);
    expect(firstBoardAutoFill(state({ losersIntroRemainingSec: 4 }))).toBe(false);
    expect(firstBoardAutoFill(state({}, board({ showing: true, stage: 'result', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBe(false);
    expect(firstBoardAutoFill(state({}, board({ stage: 'call', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBe(false);
    expect(firstBoardAutoFill(state({}, board({ stage: 'live', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBe(false);
    expect(firstBoardAutoFill(state({}, board({ stage: 'result', matchId: 3, match: { id: 3 } as CourtBoard['match'], showing: false })))).toBe(true);
    expect(firstBoardAutoFill({ ...state(), scene: 'vs_card' })).toBe(false);
  });
});
