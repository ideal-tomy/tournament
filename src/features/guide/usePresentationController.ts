import { useCallback, useEffect, useState } from 'react';
import { PRESENTATION_STEPS, clampPresentationStep } from './presentationSteps';

export function usePresentationController(initialStep = 0) {
  const [stepIndex, setStepIndex] = useState(() => clampPresentationStep(initialStep));
  const [playing, setPlaying] = useState(true);

  const next = useCallback(() => {
    setStepIndex((current) => Math.min(PRESENTATION_STEPS.length - 1, current + 1));
  }, []);
  const previous = useCallback(() => setStepIndex((current) => Math.max(0, current - 1)), []);
  const restart = useCallback(() => {
    setStepIndex(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || stepIndex >= PRESENTATION_STEPS.length - 1) return;
    const timer = window.setTimeout(next, PRESENTATION_STEPS[stepIndex].duration);
    return () => window.clearTimeout(timer);
  }, [next, playing, stepIndex]);

  return {
    stepIndex,
    step: PRESENTATION_STEPS[stepIndex],
    playing,
    setPlaying,
    next,
    previous,
    restart,
    isFirst: stepIndex === 0,
    isLast: stepIndex === PRESENTATION_STEPS.length - 1,
  };
}
