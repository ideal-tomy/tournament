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

/** 声のファイルは音楽より約10dB小さい。1.8倍でもピークは割れない。 */
const VOICE_GAIN = 1.8;
const VOICE_SEC: Partial<Record<PresentationCue, number>> = {
  challenger: 4.1,
  fight: 1.15,
  semifinal: 2.05,
  finalBattle: 1.9,
  finalBattleAgain: 2.6,
};

const pending = new Map<PresentationCue, number>();
let onBlocked: (() => void) | null = null;
let onVoice: ((seconds: number) => void) | null = null;
let voiceContext: AudioContext | null = null;

/** 自動再生が拒否された効果音を、次のタップでまとめて出す。 */
export function setPresentationAudioBlockedHandler(handler: (() => void) | null) {
  onBlocked = handler;
}

/** アナウンス中だけBGMを下げる。 */
export function setPresentationVoiceHandler(handler: ((seconds: number) => void) | null) {
  onVoice = handler;
}

export function resumePresentationVoices() {
  if (typeof AudioContext === 'undefined') return;
  voiceContext ??= new AudioContext();
  if (voiceContext.state === 'suspended') void voiceContext.resume();
}

export function flushPresentationCues() {
  const items = [...pending.entries()];
  pending.clear();
  for (const [cue, offset] of items) playPresentationAudio(cue, true, offset);
}

function outputFor(audio: HTMLAudioElement, gainValue: number) {
  const context = voiceContext;
  if (!context || context.state !== 'running' || gainValue <= 1) return;
  const source = context.createMediaElementSource(audio);
  const gain = context.createGain();
  gain.gain.value = gainValue;
  source.connect(gain).connect(context.destination);
}

export function playPresentationAudio(cue: PresentationCue, enabled: boolean, offsetSec = 0) {
  if (!enabled) return;
  const voiceSec = VOICE_SEC[cue];
  const audio = new Audio(FX.audio[cue]);
  audio.volume = 1;
  if (voiceSec == null) audio.volume = 0.7;
  else outputFor(audio, VOICE_GAIN);
  const offset = Math.max(0, offsetSec);
  const start = () => {
    if (offset > 0 && Number.isFinite(audio.duration)) audio.currentTime = Math.min(offset, Math.max(0, audio.duration - 0.05));
    void audio.play().then(() => {
      if (voiceSec != null) onVoice?.(voiceSec);
    }).catch(() => {
      pending.set(cue, offset);
      onBlocked?.();
    });
  };
  if (offset > 0 && audio.readyState < 1) audio.addEventListener('loadedmetadata', start, { once: true });
  else start();
}
