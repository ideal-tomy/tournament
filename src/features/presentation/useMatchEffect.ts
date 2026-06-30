import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import { BRACKET_LABELS } from './effectConstants';
import { ensurePresentationPreloaded } from './preloadPresentation';
import {
  resolveMatchEffectLayout,
  viewBoxToPercent,
  type MatchEffectLayout,
} from './resolveEffectLayout';
import { buildMatchTimeline, skipTimeline } from './timeline';

export type EffectPhase =
  | 'idle'
  | 'dim'
  | 'lines'
  | 'flash'
  | 'explosion'
  | 'vs'
  | 'closing';

interface UseMatchEffectOptions {
  snapshot: StageData | null;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  onComplete: () => void;
}

interface ActiveEffect {
  matchId: number;
  winnerTeamId: string;
  loserTeamId: string;
  layout: MatchEffectLayout;
}

export function useMatchEffect({
  snapshot,
  faceUrlByTeamId,
  labelByTeamId,
  onComplete,
}: UseMatchEffectOptions) {
  const [phase, setPhase] = useState<EffectPhase>('idle');
  const [lineProgress, setLineProgress] = useState(0);
  const [active, setActive] = useState<ActiveEffect | null>(null);
  const timelineRef = useRef<ReturnType<typeof buildMatchTimeline> | null>(null);
  const playingRef = useRef(false);

  const isPlaying = phase !== 'idle';

  const finishEffect = useCallback(() => {
    timelineRef.current = null;
    playingRef.current = false;
    setPhase('idle');
    setLineProgress(0);
    setActive(null);
    onComplete();
  }, [onComplete]);

  const startEffect = useCallback(
    async (payload: Extract<RealtimeEvent, { type: 'match:confirmed' }>) => {
      if (!snapshot || playingRef.current) return;

      const layout = resolveMatchEffectLayout(snapshot, payload.matchId);
      if (!layout) {
        console.warn('[presentation] layout not found for match', payload.matchId);
        onComplete();
        return;
      }

      const faceUrls = [
        ...(faceUrlByTeamId[payload.winnerTeamId] ?? []),
        ...(faceUrlByTeamId[payload.loserTeamId] ?? []),
      ];
      const preloaded = await ensurePresentationPreloaded(faceUrls);
      if (!preloaded) {
        console.warn('[presentation] preload incomplete — skipping effect');
        onComplete();
        return;
      }

      playingRef.current = true;
      setActive({
        matchId: payload.matchId,
        winnerTeamId: payload.winnerTeamId,
        loserTeamId: payload.loserTeamId,
        layout,
      });
      setLineProgress(0);
      setPhase('dim');

      const tl = buildMatchTimeline({
        onDimStart: () => setPhase('dim'),
        onLinesStart: () => setPhase('lines'),
        onLineProgress: (p) => setLineProgress(p),
        onCollision: () => setPhase('flash'),
        onExplosion: () => setPhase('explosion'),
        onVsShow: () => setPhase('vs'),
        onClose: () => setPhase('closing'),
        onComplete: finishEffect,
      });

      timelineRef.current = tl;
    },
    [snapshot, faceUrlByTeamId, onComplete, finishEffect],
  );

  const handleSkip = useCallback(() => {
    if (timelineRef.current) {
      skipTimeline(timelineRef.current);
    }
    finishEffect();
  }, [finishEffect]);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  const explosionPercent = active
    ? viewBoxToPercent(active.layout.collision, active.layout.viewBox)
    : { x: 50, y: 50 };

  const vsVisible = phase === 'vs' || phase === 'closing';
  const showOverlay = phase === 'lines' || phase === 'flash' || phase === 'explosion';
  const showExplosion = phase === 'explosion';
  const showFlash = phase === 'flash';

  return {
    isPlaying,
    phase,
    lineProgress,
    active,
    explosionPercent,
    vsVisible,
    showOverlay,
    showExplosion,
    showFlash,
    dimmed: phase !== 'idle' && phase !== 'closing',
    startEffect,
    handleSkip,
    winnerLabel: active ? (labelByTeamId[active.winnerTeamId] ?? 'Winner') : '',
    loserLabel: active ? (labelByTeamId[active.loserTeamId] ?? 'Loser') : '',
    winnerFaces: active ? (faceUrlByTeamId[active.winnerTeamId] ?? []) : [],
    loserFaces: active ? (faceUrlByTeamId[active.loserTeamId] ?? []) : [],
    bracketLabel: active ? BRACKET_LABELS[active.layout.bracket] : '',
    vsClosing: phase === 'closing',
  };
}
