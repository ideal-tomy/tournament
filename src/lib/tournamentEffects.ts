const ROOT = '/tournament-effects';

function audioFile(name: string) {
  return `${ROOT}/audio/${encodeURIComponent(name)}`;
}

export const TOURNAMENT_EFFECTS = {
  backgrounds: {
    tournament: `${ROOT}/backgrounds/tournament-bg.webp`,
    cardTable: `${ROOT}/backgrounds/card-table-bg.webp`,
    vsIdle: `${ROOT}/backgrounds/vs-idle.mp4`,
    vsBlackHole: `${ROOT}/backgrounds/vs-black-hole.webp`,
    drawTable: `${ROOT}/backgrounds/draw-table.webp`,
    dartNebula: `${ROOT}/backgrounds/dart-nebula.webp`,
    pairRings: `${ROOT}/backgrounds/pair-rings.webp`,
    winnerShaft: `${ROOT}/backgrounds/winner-shaft.webp`,
    championCorona: `${ROOT}/backgrounds/champion-corona.webp`,
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
    dartFly: audioFile('dart-fly.mp3'),
    impact: audioFile('dragon-studio-hard-heavy-impact-515256.mp3'),
    cardFlip: audioFile('card-flip.mp3'),
    cardOpen: audioFile('トランプが開かれたとき.mp3'),
    teamConfirm: audioFile('team-confirm.mp3'),
    pairImpact: audioFile('audiopapkin-sound-design-elements-impact-sfx-ps-130-420088.mp3'),
    opening: audioFile('オープニング.mp3'),
    pair: audioFile('ペア.mp3'),
  },
} as const;

function flattenUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(flattenUrls);
}

export const TOURNAMENT_EFFECT_ASSET_URLS = flattenUrls(TOURNAMENT_EFFECTS);
export const TOURNAMENT_EFFECT_IMAGE_URLS = TOURNAMENT_EFFECT_ASSET_URLS.filter(
  (url) => !url.endsWith('.mp3') && !url.endsWith('.mp4'),
);
export const TOURNAMENT_EFFECT_AUDIO_URLS = TOURNAMENT_EFFECT_ASSET_URLS.filter((url) =>
  url.endsWith('.mp3'),
);
