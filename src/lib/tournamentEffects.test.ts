import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_EFFECT_ASSET_URLS,
  TOURNAMENT_EFFECT_AUDIO_URLS,
  TOURNAMENT_EFFECT_IMAGE_URLS,
} from './tournamentEffects';

describe('tournament effect asset catalog', () => {
  it('contains every formal asset exactly once', () => {
    expect(TOURNAMENT_EFFECT_ASSET_URLS).toHaveLength(21);
    expect(new Set(TOURNAMENT_EFFECT_ASSET_URLS).size).toBe(21);
  });

  it('separates images and audio', () => {
    expect(TOURNAMENT_EFFECT_IMAGE_URLS).toHaveLength(17);
    expect(TOURNAMENT_EFFECT_AUDIO_URLS).toHaveLength(4);
  });
});
