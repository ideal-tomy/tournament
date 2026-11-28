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
      courts: { count: 2, showBracket: false, spotlight: null, boards: [first, board({ board: 2, stage: 'live', matchId: 5 })] },
      ...flow,
    },
  } as DrawState;
}

describe('firstBoardAutoFill', () => {
  it('台1が空いていて次の試合があるときだけ入れる', () => {
    expect(firstBoardAutoFill(state())).toBe(1);
    expect(firstBoardAutoFill(state({ nextMatch: null }))).toBeNull();
    expect(firstBoardAutoFill(state({ losersIntroRemainingSec: 4 }))).toBeNull();
    expect(firstBoardAutoFill(state({}, board({ showing: true, stage: 'result', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBeNull();
    expect(firstBoardAutoFill(state({}, board({ stage: 'call', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBeNull();
    expect(firstBoardAutoFill(state({}, board({ stage: 'live', matchId: 3, match: { id: 3 } as CourtBoard['match'] })))).toBeNull();
    expect(firstBoardAutoFill(state({}, board({ stage: 'result', matchId: 3, match: { id: 3 } as CourtBoard['match'], showing: false })))).toBe(1);
    expect(firstBoardAutoFill({ ...state(), scene: 'vs_card' })).toBeNull();
  });
  it('台1が使用中でも台2の演出終了後に割り当て、演出中は待つ', () => {
    const first = board({ stage: 'live', matchId: 1 });
    const second = board({ board: 2, stage: 'result', matchId: 2 });
    const courts = { count: 2, showBracket: false, spotlight: null, boards: [first, second] };
    expect(firstBoardAutoFill(state({ courts }))).toBe(2);
    expect(firstBoardAutoFill(state({ courts: { ...courts, boards: [first, { ...second, showing: true }] } }))).toBeNull();
    expect(firstBoardAutoFill(state({ courts, championTeamId: 'winner' }))).toBeNull();
  });
});
