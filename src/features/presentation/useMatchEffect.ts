import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import { getMatchBracketKind } from '../progression/progression';
import { BRACKET_LABELS } from './effectConstants';
import { ensurePresentationPreloaded } from './preloadPresentation';
import {
  resolveAdvanceEffectLayout,
  viewBoxToPercent,
  type MatchEffectLayout,
} from './resolveEffectLayout';
import { buildPresentationTimeline, skipTimeline } from './timeline';
import type { ClashPhase } from './ClashPopup';

export type EffectPhase =
  | 'idle'
  | 'winner'
  | 'winnerClosing'
  | 'dim'
  | 'lines'
  | 'clash'
  | 'flash'
  | 'vsAnticipation'
  | 'vsFlameBurst'
  | 'vs'
  | 'closing';

interface ActiveEffect {
  matchId: number;
  winnerTeamId: string;
  loserTeamId: string;
  winnerBracketLabel: string;
  teamAId?: string;
  teamBId?: string;
  layout?: MatchEffectLayout;
}

interface UseMatchEffectOptions {
  snapshot: StageData | null;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  onComplete: () => void;
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
  const timelineRef = useRef<ReturnType<typeof buildPresentationTimeline> | null>(null);
  const playingRef = useRef(false);

  const isPlaying = phase !== 'idle';
  const hasAdvance = Boolean(active?.layout && active.teamAId && active.teamBId);

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

      const match = snapshot.match.find((m) => m.id === payload.matchId);
      const bracketKind = match ? getMatchBracketKind(snapshot, match) : 'winner';
      const winnerBracketLabel = BRACKET_LABELS[bracketKind];

      const advance = payload.advanceEffect;
      let layout: MatchEffectLayout | undefined;
      if (advance) {
        layout = resolveAdvanceEffectLayout(snapshot, advance) ?? undefined;
        if (!layout) {
          console.warn('[presentation] advance layout not found', advance.nextMatchId);
        }
      }

      const preloadIds = [payload.winnerTeamId];
      if (advance) {
        preloadIds.push(advance.teamAId, advance.teamBId);
      }
      const faceUrls = preloadIds.flatMap((id) => faceUrlByTeamId[id] ?? []);
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
        winnerBracketLabel,
        teamAId: advance?.teamAId,
        teamBId: advance?.teamBId,
        layout,
      });
      setLineProgress(0);
      setPhase('winner');

      const tl = buildPresentationTimeline(
        Boolean(advance && layout),
        {
          onShow: () => setPhase('winner'),
          onClose: () => setPhase('winnerClosing'),
        },
        advance && layout
          ? {
              onDimStart: () => setPhase('dim'),
              onLinesStart: () => setPhase('lines'),
              onLineProgress: (p) => setLineProgress(p),
              onClashStart: () => setPhase('clash'),
              onCollision: () => setPhase('flash'),
              onVsAnticipation: () => setPhase('vsAnticipation'),
              onVsFlameBurst: () => setPhase('vsFlameBurst'),
              onVsShow: () => setPhase('vs'),
              onClose: () => setPhase('closing'),
            }
          : undefined,
        finishEffect,
      );

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

  const explosionPercent =
    active?.layout != null
      ? viewBoxToPercent(active.layout.collision, active.layout.viewBox)
      : { x: 50, y: 50 };

  const winnerVisible = phase === 'winner' || phase === 'winnerClosing';
  const winnerClosing = phase === 'winnerClosing';
  const vsVisible = phase === 'vs' || phase === 'closing';
  const vsClosing = phase === 'closing';
  const vsAnticipationVisible = phase === 'vsAnticipation';
  const vsFlameBurstVisible = phase === 'vsFlameBurst';

  const clashPhase: ClashPhase =
    phase === 'clash' ? 'approach' : phase === 'flash' ? 'impact' : 'hidden';

  const showBracketOverlay =
    hasAdvance && (phase === 'lines' || phase === 'clash' || phase === 'flash');
  const showBracketExplosion = phase === 'flash' && hasAdvance;
  const showFlash = phase === 'flash';
  const dimmed =
    hasAdvance &&
    phase !== 'idle' &&
    phase !== 'winner' &&
    phase !== 'winnerClosing' &&
    phase !== 'closing';

  const advanceBracketLabel = active?.layout
    ? BRACKET_LABELS[active.layout.bracket]
    : '';

  return {
    isPlaying,
    phase,
    lineProgress,
    active,
    hasAdvance,
    explosionPercent,
    winnerVisible,
    winnerClosing,
    clashPhase,
    vsAnticipationVisible,
    vsFlameBurstVisible,
    vsVisible,
    vsClosing,
    showBracketOverlay,
    showBracketExplosion,
    showFlash,
    dimmed,
    startEffect,
    handleSkip,
    winnerLabel: active ? (labelByTeamId[active.winnerTeamId] ?? 'Winner') : '',
    winnerFaces: active ? (faceUrlByTeamId[active.winnerTeamId] ?? []) : [],
    winnerBracketLabel: active?.winnerBracketLabel ?? '',
    teamALabel: active?.teamAId ? (labelByTeamId[active.teamAId] ?? 'Team A') : '',
    teamBLabel: active?.teamBId ? (labelByTeamId[active.teamBId] ?? 'Team B') : '',
    teamAFaces: active?.teamAId ? (faceUrlByTeamId[active.teamAId] ?? []) : [],
    teamBFaces: active?.teamBId ? (faceUrlByTeamId[active.teamBId] ?? []) : [],
    bracketLabel: advanceBracketLabel,
  };
}
