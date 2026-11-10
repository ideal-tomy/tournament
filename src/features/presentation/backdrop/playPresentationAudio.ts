import { TOURNAMENT_EFFECTS as FX } from '../../../lib/tournamentEffects';

export type PresentationCue = keyof typeof FX.audio;

/**
 * ファイル先頭から、絵と合わせる山までの秒。
 * impact は刺さる瞬間のアタック、cardOpen は顔が見える瞬間のピーク、
 * pairImpact は2枚が中央で重なる瞬間の打撃。
 */
export const CUE_SYNC_LEAD_SEC: Partial<Record<PresentationCue, number>> = {
  impact: 0.04,
  cardOpen: 0.42,
  pairImpact: 0.7,
};

/** 指定した瞬間に音の山が来るよう、再生開始を早めたタイムライン位置。 */
export function syncedCueAt(visualAt: number, cue: PresentationCue) {
  return Math.max(0, visualAt - (CUE_SYNC_LEAD_SEC[cue] ?? 0));
}

/**
 * 画面が遅れて場面に入ったとき、溜めの途中なら音も途中から出す。
 * 山を過ぎていたら鳴らさない。まだ再生前なら null（タイムラインに任せる）。
 */
export function cueCatchUpOffset(visualAt: number, elapsed: number, cue: PresentationCue) {
  const start = syncedCueAt(visualAt, cue);
  if (elapsed + 0.001 < start || elapsed > visualAt + 0.2) return null;
  return Math.max(0, elapsed - start);
}

export function playPresentationAudio(cue: PresentationCue, enabled: boolean, offsetSec = 0) {
  if (!enabled) return;
  const audio = new Audio(FX.audio[cue]);
  audio.volume = 0.7;
  const offset = Math.max(0, offsetSec);
  const start = () => {
    if (offset > 0 && Number.isFinite(audio.duration)) audio.currentTime = Math.min(offset, Math.max(0, audio.duration - 0.05));
    void audio.play().catch(() => undefined);
  };
  if (offset > 0 && audio.readyState < 1) audio.addEventListener('loadedmetadata', start, { once: true });
  else start();
}
