export type RehearsalTimingPreset = 'show' | 'fast' | 'instant';
// Movement animations stay identical; only pauses/holds differ.
export function rehearsalTiming(preset: RehearsalTimingPreset = 'show') {
  if (preset === 'instant') {
    return { winner: 0, bracket: 0, bracketInitial: 0, vsLead: 0, vsHold: 0, match: 0.05, award: 0, podium: 0 };
  }
  return preset === 'fast'
    ? { winner: 6.5, bracket: 6, bracketInitial: 1, vsLead: 3.5, vsHold: 1.8, match: 1.5, award: 2, podium: 13 }
    : { winner: 9, bracket: 6, bracketInitial: 2, vsLead: 3.5, vsHold: 5, match: 3, award: 19, podium: 16 };
}
