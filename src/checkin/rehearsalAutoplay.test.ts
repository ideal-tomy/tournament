import { describe, expect, it } from 'vitest';
import { nextRehearsalCommand } from './rehearsalAutoplay';

type AutoplayState = Parameters<typeof nextRehearsalCommand>[0];

const base = {
  checkinStatus: 'closed',
  checkinRevision: 1,
  timingPreset: 'instant' as const,
  session: { id: 'd', revealOrder: [], committedAt: '' },
  version: 3,
  scene: 'interval',
  flow: {
    phase: 'interval',
    currentMatch: null,
    canAdvance: false,
    canGameStart: false,
    canStart: false,
    completedMatches: 0,
    courts: {
      count: 2,
      showBracket: false,
      spotlight: null,
      boards: [
        { board: 1, matchId: 0, stage: 'call' as const, startedAt: null, showing: false, match: null },
        { board: 2, matchId: 1, stage: 'call' as const, startedAt: null, showing: false, match: null },
      ],
    },
  },
} as const;
const asState = (value: object) => value as unknown as AutoplayState;

describe('nextRehearsalCommand', () => {
  it('starts the first called board', () => {
    const { command } = nextRehearsalCommand(asState(base), null);
    expect(command?.path).toBe('/api/tournament/court-start');
    expect(command?.body.board).toBe(1);
  });
  it('advances bracket when requested', () => {
    const { command } = nextRehearsalCommand(
      asState({ ...base, scene: 'bracket', flow: { ...base.flow, canAdvance: true, courts: null } }),
      null,
    );
    expect(command?.path).toBe('/api/tournament/advance');
  });
});