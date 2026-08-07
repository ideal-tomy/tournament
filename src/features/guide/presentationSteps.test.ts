import { describe, expect, it } from 'vitest';
import { PRESENTATION_STEPS, clampPresentationStep } from './presentationSteps';

describe('presentation steps', () => {
  it('defines the complete 14-step story with stable targets', () => {
    expect(PRESENTATION_STEPS).toHaveLength(14);
    expect(new Set(PRESENTATION_STEPS.map((step) => step.id)).size).toBe(14);
    expect(PRESENTATION_STEPS.every((step) => step.target.length > 0)).toBe(true);
  });

  it('keeps total playback between 90 seconds and 2 minutes', () => {
    const total = PRESENTATION_STEPS.reduce((sum, step) => sum + step.duration, 0);
    expect(total).toBeGreaterThanOrEqual(90_000);
    expect(total).toBeLessThanOrEqual(120_000);
  });

  it('clamps invalid step indexes', () => {
    expect(clampPresentationStep(-10)).toBe(0);
    expect(clampPresentationStep(999)).toBe(13);
  });
});
