import { describe, expect, it } from 'vitest';
import type { CourtBoard, DrawState } from './DrawControl';
import { ceremonyAutoStart } from './ceremonyAutoStart';

function board(patch: Partial<CourtBoard> = {}): CourtBoard {
  return { board: 1, matchId: 9, stage: 'result', startedAt: null, showing: false, match: { id: 9 } as CourtBoard['match'], ...patch };
}

function state(patch: Partial<NonNullable<DrawState['flow']>> = {}, boards = [board(), { ...board(), board: 2 }]): DrawState {
  return {
    scene: 'interval',
    version: 1,
    flow: {
      championTeamId: 'team-a',
      losersIntroRemainingSec: 0,
      courts: { count: 2, showBracket: false, spotlight: null, boards },
      ...patch,
    },
  } as unknown as DrawState;
}

describe('ceremonyAutoStart', () => {
  it('優勝が付いて演出が終わっていれば表彰へ進む', () => {
    expect(ceremonyAutoStart(state())).toBe(true);
    expect(ceremonyAutoStart(state({ championTeamId: null }))).toBe(false);
    expect(ceremonyAutoStart(state({}, [board({ showing: true }), { ...board(), board: 2 }]))).toBe(false);
    expect(ceremonyAutoStart(state({}, [board({ stage: 'live' }), { ...board(), board: 2, stage: 'result' }]))).toBe(false);
  });
});
