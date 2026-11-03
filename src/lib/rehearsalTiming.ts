export type RehearsalTimingPreset = 'show' | 'fast';
// Movement animations stay identical; only pauses/holds differ.
export function rehearsalTiming(preset: RehearsalTimingPreset = 'show') {
  return preset === 'fast'
    ? { winner: 4.2, bracket: 4.6, bracketInitial: 1, vsLead: 3.5, vsHold: 1.8, match: 1.5, award: 2 }
    : { winner: 6, bracket: 6, bracketInitial: 2, vsLead: 3.5, vsHold: 5, match: 3, award: 19 };
}
