import type { PresentationMode } from '../../../types';

export function postMatchTiming(mode: PresentationMode) {
  const factor = mode === 'full' ? 1 : mode === 'short' ? 0.7 : 0.5;
  return { advance: 4 * factor, approach: 6 * factor, impact: 8 * factor, hold: Math.max(9.5 * factor, 8 * factor + 1) };
}

export function postMatchPhase(time: number, mode: PresentationMode) {
  const t = postMatchTiming(mode);
  if (time >= t.hold) return 'NEXT MATCH HOLD';
  if (time >= t.impact) return 'IMPACT → VS';
  if (time >= t.approach) return 'OPPONENTS';
  if (time >= t.advance) return 'BRACKET ADVANCE';
  return 'WIN HOLD';
}
