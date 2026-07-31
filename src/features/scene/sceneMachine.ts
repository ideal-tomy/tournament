import type { Scene } from '../../types';

export const SCENES = [
  'idle',
  'opening',
  'draw',
  'bracket',
  'vs_card',
  'match_live',
  'result',
  'interval',
  'award',
  'finished',
] as const satisfies readonly Scene[];

/** 許可遷移。定義外はアプリ層で拒否する */
export const TRANSITIONS: Record<Scene, Scene[]> = {
  idle: ['opening', 'bracket', 'draw', 'finished'],
  opening: ['draw', 'bracket', 'interval', 'idle'],
  draw: ['bracket', 'opening', 'idle'],
  bracket: ['vs_card', 'interval', 'award', 'finished', 'opening', 'idle', 'match_live'],
  vs_card: ['match_live', 'bracket'],
  match_live: ['result', 'bracket', 'vs_card'],
  result: ['bracket'],
  interval: ['bracket', 'vs_card', 'opening'],
  award: ['finished', 'bracket'],
  finished: ['idle', 'bracket'],
};

export function canTransition(from: Scene, to: Scene, force = false): boolean {
  if (force) return true;
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** 演出尺（秒）。復帰時に経過超過なら最終フレーム */
export const SCENE_DURATION_SEC: Partial<Record<Scene, number>> = {
  result: 3.5,
  draw: 120,
};

export function shouldRestoreCompleted(
  scene: Scene,
  sceneStartedAt: string | null,
): boolean {
  const duration = SCENE_DURATION_SEC[scene];
  if (duration == null || !sceneStartedAt) return false;
  const elapsed = (Date.now() - new Date(sceneStartedAt).getTime()) / 1000;
  return elapsed >= duration;
}
