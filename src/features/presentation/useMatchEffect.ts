import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import { getMatchBracketKind } from '../progression/progression';
import { BRACKET_LABELS } from './effectConstants';
import { ensurePresentationPreloaded } from './preloadPresentation';
import { resolveAdvanceEffectLayout, type MatchEffectLayout } from './resolveEffectLayout';

export interface ActiveEffect {
  matchId: number;
  advance: boolean;
  winnerTeamId: string;
  loserTeamId: string;
  winnerBracketLabel: string;
  bracketLabel: string;
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
  const [activeEffect, setActiveEffect] = useState<ActiveEffect | null>(null);
  const killTimelineRef = useRef<(() => void) | null>(null);
  const playingRef = useRef(false);

  const finishEffect = useCallback(() => {
    killTimelineRef.current = null;
    playingRef.current = false;
    setActiveEffect(null);
    onComplete();
  }, [onComplete]);

  const registerTimelineKill = useCallback((kill: () => void) => {
    killTimelineRef.current = kill;
  }, []);

  const startEffect = useCallback(
    async (payload: Extract<RealtimeEvent, { type: 'match:confirmed' }>) => {
      if (!snapshot || playingRef.current) return;

      const match = snapshot.match.find((m) => m.id === payload.matchId);
      const bracketKind = match ? getMatchBracketKind(snapshot, match) : 'winner';
      const winnerBracketLabel = BRACKET_LABELS[bracketKind];

      const advancePayload = payload.advanceEffect;
      const hasAdvance = Boolean(advancePayload);
      let layout: MatchEffectLayout | undefined;
      if (advancePayload) {
        layout = resolveAdvanceEffectLayout(snapshot, advancePayload) ?? undefined;
        if (!layout) {
          console.warn('[presentation] advance layout not found', advancePayload.nextMatchId);
        }
      }

      const preloadIds = [payload.winnerTeamId];
      if (advancePayload) {
        preloadIds.push(advancePayload.teamAId, advancePayload.teamBId);
      }
      const faceUrls = preloadIds.flatMap((id) => faceUrlByTeamId[id] ?? []);
      const preloaded = await ensurePresentationPreloaded(faceUrls);
      if (!preloaded) {
        console.warn('[presentation] preload incomplete — skipping effect');
        onComplete();
        return;
      }

      playingRef.current = true;

      const bracketLabel = layout ? BRACKET_LABELS[layout.bracket] : '';

      setActiveEffect({
        matchId: payload.matchId,
        advance: hasAdvance && Boolean(layout),
        winnerTeamId: payload.winnerTeamId,
        loserTeamId: payload.loserTeamId,
        winnerBracketLabel,
        bracketLabel,
        teamAId: advancePayload?.teamAId,
        teamBId: advancePayload?.teamBId,
        layout,
      });
    },
    [snapshot, faceUrlByTeamId, onComplete],
  );

  const handleSkip = useCallback(() => {
    killTimelineRef.current?.();
    finishEffect();
  }, [finishEffect]);

  useEffect(() => {
    return () => {
      killTimelineRef.current?.();
    };
  }, []);

  const winnerLabel = activeEffect
    ? (labelByTeamId[activeEffect.winnerTeamId] ?? 'Winner')
    : '';
  const winnerFaces = activeEffect
    ? (faceUrlByTeamId[activeEffect.winnerTeamId] ?? [])
    : [];
  const teamALabel = activeEffect?.teamAId
    ? (labelByTeamId[activeEffect.teamAId] ?? 'Team A')
    : '';
  const teamBLabel = activeEffect?.teamBId
    ? (labelByTeamId[activeEffect.teamBId] ?? 'Team B')
    : '';
  const teamAFaces = activeEffect?.teamAId
    ? (faceUrlByTeamId[activeEffect.teamAId] ?? [])
    : [];
  const teamBFaces = activeEffect?.teamBId
    ? (faceUrlByTeamId[activeEffect.teamBId] ?? [])
    : [];

  return {
    activeEffect,
    startEffect,
    finishEffect,
    handleSkip,
    registerTimelineKill,
    winnerLabel,
    winnerFaces,
    winnerBracketLabel: activeEffect?.winnerBracketLabel ?? '',
    teamALabel,
    teamBLabel,
    teamAFaces,
    teamBFaces,
    bracketLabel: activeEffect?.bracketLabel ?? '',
  };
}
