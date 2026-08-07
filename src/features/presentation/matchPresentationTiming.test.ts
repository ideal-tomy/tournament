import { describe, expect, it } from 'vitest';
import {
  MATCH_PRESENTATION_TIMING,
  isPresentationDeadlineReached,
  presentationDeadlineIso,
  presentationRemainingMs,
} from './matchPresentationTiming';

describe('match presentation timing', () => {
  it('keeps the requested winner, bracket and next-match holds', () => {
    expect(MATCH_PRESENTATION_TIMING.resultTotal).toBe(5800);
    expect(MATCH_PRESENTATION_TIMING.bracketSettle).toBe(2000);
    expect(MATCH_PRESENTATION_TIMING.vsMinimumHold).toBe(5000);
  });

  it('creates and evaluates an absolute deadline', () => {
    const deadline = presentationDeadlineIso(5000, 10_000);
    expect(presentationRemainingMs(deadline, 12_000)).toBe(3000);
    expect(isPresentationDeadlineReached(deadline, 14_999)).toBe(false);
    expect(isPresentationDeadlineReached(deadline, 15_000)).toBe(true);
  });

  it('treats a missing or invalid deadline as ready', () => {
    expect(isPresentationDeadlineReached(undefined)).toBe(true);
    expect(isPresentationDeadlineReached('invalid')).toBe(true);
  });
});
