import { TOURNAMENT_EFFECT_AUDIO_URLS, TOURNAMENT_EFFECT_IMAGE_URLS } from '../lib/tournamentEffects';

let started = false;

/** Warm the browser cache for venue effects. Failures are logged and never block the show. */
export function preloadPresentationAssets() {
  if (started) return;
  started = true;
  for (const url of TOURNAMENT_EFFECT_IMAGE_URLS) {
    const image = new Image();
    image.src = url;
    void image.decode().catch(() => console.warn(`[preload] image unavailable: ${url}`));
  }
  for (const url of TOURNAMENT_EFFECT_AUDIO_URLS) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
  }
}
