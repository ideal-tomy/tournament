export const MATCH_PRESENTATION_TIMING = {
  resultTotal: 4000,
  bracketSettle: 2000,
  vsIntro: 900,
  vsMinimumHold: 5000,
} as const;

export function presentationDeadlineIso(durationMs: number, nowMs = Date.now()): string {
  return new Date(nowMs + Math.max(0, durationMs)).toISOString();
}

export function presentationRemainingMs(
  deadlineIso: unknown,
  nowMs = Date.now(),
): number {
  if (typeof deadlineIso !== 'string') return 0;
  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, deadline - nowMs);
}

export function isPresentationDeadlineReached(
  deadlineIso: unknown,
  nowMs = Date.now(),
): boolean {
  return presentationRemainingMs(deadlineIso, nowMs) === 0;
}
