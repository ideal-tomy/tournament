const ROOT = '/tournament-effects';

export const TOURNAMENT_EFFECTS = {
  backgrounds: {
    tournament: `${ROOT}/backgrounds/tournament-bg.webp`,
    cardTable: `${ROOT}/backgrounds/card-table-bg.webp`,
  },
  cards: {
    back: `${ROOT}/cards/card-back.webp`,
    front: `${ROOT}/cards/card-front.webp`,
    impactMark: `${ROOT}/cards/impact-mark.png`,
  },
  darts: {
    main: `${ROOT}/darts/dart-main.png`,
    motionStreak: `${ROOT}/darts/dart-motion-streak.png`,
  },
  effects: {
    impactFlash: `${ROOT}/effects/impact-flash.png`,
    goldenSparks: `${ROOT}/effects/golden-sparks.png`,
    blueRing: `${ROOT}/effects/blue-ring.png`,
    impactCloud: `${ROOT}/effects/impact-cloud.png`,
    debris: `${ROOT}/effects/debris.png`,
    vsMark: `${ROOT}/effects/vs-mark.png`,
    celebrationConfetti: `${ROOT}/effects/celebration-confetti.png`,
  },
  frames: {
    player: `${ROOT}/frames/player-frame.png`,
    nameplate: `${ROOT}/frames/nameplate.png`,
    teamPlate: `${ROOT}/frames/team-plate.png`,
  },
  audio: {
    dartFly: `${ROOT}/audio/dart-fly.mp3`,
    impact: `${ROOT}/audio/impact.mp3`,
    cardFlip: `${ROOT}/audio/card-flip.mp3`,
    teamConfirm: `${ROOT}/audio/team-confirm.mp3`,
  },
} as const;

function flattenUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(flattenUrls);
}

export const TOURNAMENT_EFFECT_ASSET_URLS = flattenUrls(TOURNAMENT_EFFECTS);
export const TOURNAMENT_EFFECT_IMAGE_URLS = TOURNAMENT_EFFECT_ASSET_URLS.filter(
  (url) => !url.endsWith('.mp3'),
);
export const TOURNAMENT_EFFECT_AUDIO_URLS = TOURNAMENT_EFFECT_ASSET_URLS.filter((url) =>
  url.endsWith('.mp3'),
);
