import { describe, expect, it } from 'vitest';
import {
  DRAW_ANIMATION_TIMING,
  drawSeconds,
  estimateDrawDurationMs,
  estimateDrawDurationSec,
} from './drawAnimationTiming';

describe('draw animation timing', () => {
  it('keeps the requested impact and confirmation timings', () => {
    expect(DRAW_ANIMATION_TIMING.dartFlight).toBe(600);
    expect(DRAW_ANIMATION_TIMING.impactHold).toBe(2000);
    expect(DRAW_ANIMATION_TIMING.cardFlip).toBe(700);
    expect(DRAW_ANIMATION_TIMING.playerReveal).toBe(800);
    expect(DRAW_ANIMATION_TIMING.pairConfirmHold).toBe(7000);
    expect(DRAW_ANIMATION_TIMING.transitionToNext).toBe(800);
  });

  it('converts milliseconds to GSAP seconds', () => {
    expect(drawSeconds('impactHold')).toBe(2);
    expect(drawSeconds('cardFlip')).toBe(0.7);
  });

  it('calculates full duration from the same timing source', () => {
    const zeroParticipants = estimateDrawDurationMs(0, 'full', 0);
    const oneParticipant = estimateDrawDurationMs(1, 'full', 0);
    const twoParticipants = estimateDrawDurationMs(2, 'full', 0);
    expect(twoParticipants - oneParticipant).toBe(oneParticipant - zeroParticipants);
    expect(estimateDrawDurationSec(2, 'full')).toBe(
      Math.ceil(estimateDrawDurationMs(2, 'full', 1) / 1000),
    );
  });

  it('adds one confirmation sequence per team', () => {
    const withoutTeam = estimateDrawDurationMs(2, 'full', 0);
    const withTeam = estimateDrawDurationMs(2, 'full', 1);
    expect(withTeam - withoutTeam).toBe(
      DRAW_ANIMATION_TIMING.pairReveal +
        DRAW_ANIMATION_TIMING.pairConfirmHold +
        DRAW_ANIMATION_TIMING.transitionToNext,
    );
  });

  it('does not produce a negative duration', () => {
    expect(estimateDrawDurationMs(-10, 'full')).toBe(estimateDrawDurationMs(0, 'full'));
  });
});
