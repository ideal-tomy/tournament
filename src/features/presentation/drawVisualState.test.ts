import { describe, expect, it } from 'vitest';
import {
  groupDrawParticipants,
  shouldShowBackOnlyEffect,
  type DrawVisualPhase,
} from './drawVisualState';

describe('shouldShowBackOnlyEffect', () => {
  it('shows a hole only during impact on the card back', () => {
    expect(shouldShowBackOnlyEffect('back', 'impact')).toBe(true);
  });

  it.each<DrawVisualPhase>([
    'cardReady',
    'dartFlying',
    'flipping',
    'playerRevealed',
    'pairConfirmed',
  ])('hides back-only effects during %s', (phase) => {
    expect(shouldShowBackOnlyEffect('back', phase)).toBe(false);
  });

  it('never shows a hole on the card front', () => {
    const phases: DrawVisualPhase[] = [
      'cardReady',
      'dartFlying',
      'impact',
      'flipping',
      'playerRevealed',
      'pairConfirmed',
    ];
    expect(phases.every((phase) => !shouldShowBackOnlyEffect('front', phase))).toBe(true);
  });
});

describe('groupDrawParticipants', () => {
  it('preserves reveal order while grouping doubles', () => {
    expect(groupDrawParticipants(['a', 'd', 'b', 'c'], 2)).toEqual([
      ['a', 'd'],
      ['b', 'c'],
    ]);
  });

  it('keeps the final incomplete or trio team', () => {
    expect(groupDrawParticipants(['a', 'b', 'c'], 3)).toEqual([['a', 'b', 'c']]);
    expect(groupDrawParticipants(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('uses a safe team size for invalid input', () => {
    expect(groupDrawParticipants(['a', 'b'], 0)).toEqual([['a'], ['b']]);
  });
});
