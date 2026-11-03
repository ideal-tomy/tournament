import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_EFFECT_ASSET_URLS,
  TOURNAMENT_EFFECT_AUDIO_URLS,
  TOURNAMENT_EFFECT_IMAGE_URLS,
} from './tournamentEffects';

describe('tournament effect asset catalog', () => {
  it('contains every formal asset exactly once', () => {
    expect(TOURNAMENT_EFFECT_ASSET_URLS).toHaveLength(27);
    expect(new Set(TOURNAMENT_EFFECT_ASSET_URLS).size).toBe(27);
  });

  it('separates images and audio', () => {
    expect(TOURNAMENT_EFFECT_IMAGE_URLS).toHaveLength(22);
    expect(TOURNAMENT_EFFECT_AUDIO_URLS).toHaveLength(4);
  });
});
