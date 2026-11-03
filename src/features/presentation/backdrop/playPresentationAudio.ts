import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';

export type PresentationCue = keyof typeof FX.audio;

export function playPresentationAudio(cue: PresentationCue, enabled: boolean) {
  if (!enabled) return;
  const audio = new Audio(FX.audio[cue]);
  audio.volume = 0.7;
  void audio.play().catch(() => undefined);
}
