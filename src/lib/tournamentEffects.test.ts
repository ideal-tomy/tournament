import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_EFFECT_ASSET_URLS,
  TOURNAMENT_EFFECT_AUDIO_URLS,
  TOURNAMENT_EFFECT_IMAGE_URLS,
} from './tournamentEffects';

describe('tournament effect asset catalog', () => {
  it('contains every formal asset exactly once', () => {
    expect(TOURNAMENT_EFFECT_ASSET_URLS).toHaveLength(32);
    expect(new Set(TOURNAMENT_EFFECT_ASSET_URLS).size).toBe(32);
  });

  it('separates images and audio', () => {
    expect(TOURNAMENT_EFFECT_IMAGE_URLS).toHaveLength(23);
    expect(TOURNAMENT_EFFECT_AUDIO_URLS).toHaveLength(8);
    expect(TOURNAMENT_EFFECT_AUDIO_URLS).toEqual(expect.arrayContaining([
      '/tournament-effects/audio/dart-fly.mp3',
      '/tournament-effects/audio/dragon-studio-hard-heavy-impact-515256.mp3',
      `/tournament-effects/audio/${encodeURIComponent('トランプが開かれたとき.mp3')}`,
      '/tournament-effects/audio/audiopapkin-sound-design-elements-impact-sfx-ps-130-420088.mp3',
      `/tournament-effects/audio/${encodeURIComponent('オープニング.mp3')}`,
      `/tournament-effects/audio/${encodeURIComponent('ペア.mp3')}`,
    ]));
  });
});
