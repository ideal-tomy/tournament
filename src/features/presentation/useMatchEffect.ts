import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import { BRACKET_LABELS } from './effectConstants';
import { ensurePresentationPreloaded } from './preloadPresentation';
import {
  resolveAdvanceEffectLayout,
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
  nextMatchId: number;
  teamAId: string;
  teamBId: string;
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

      const advance = payload.advanceEffect;
      if (!advance) {
        onComplete();
        return;
      }

      const layout = resolveAdvanceEffectLayout(snapshot, advance);
      if (!layout) {
        console.warn('[presentation] advance layout not found', advance.nextMatchId);
        onComplete();
        return;
      }

      const faceUrls = [
        ...(faceUrlByTeamId[advance.teamAId] ?? []),
        ...(faceUrlByTeamId[advance.teamBId] ?? []),
      ];
      const preloaded = await ensurePresentationPreloaded(faceUrls);
      if (!preloaded) {
        console.warn('[presentation] preload incomplete — skipping effect');
        onComplete();
        return;
      }

      playingRef.current = true;
      setActive({
        nextMatchId: advance.nextMatchId,
        teamAId: advance.teamAId,
        teamBId: advance.teamBId,
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
    teamALabel: active ? (labelByTeamId[active.teamAId] ?? 'Team A') : '',
    teamBLabel: active ? (labelByTeamId[active.teamBId] ?? 'Team B') : '',
    teamAFaces: active ? (faceUrlByTeamId[active.teamAId] ?? []) : [],
    teamBFaces: active ? (faceUrlByTeamId[active.teamBId] ?? []) : [],
    bracketLabel: active ? BRACKET_LABELS[active.layout.bracket] : '',
    vsClosing: phase === 'closing',
  };
}
