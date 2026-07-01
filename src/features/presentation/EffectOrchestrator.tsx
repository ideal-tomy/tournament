import { useEffect } from 'react';
import BracketView from '../bracket/BracketView';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import PresentationStage from './PresentationStage';
import { useMatchEffect } from './useMatchEffect';
import { ensurePresentationPreloaded } from './preloadPresentation';

interface EffectOrchestratorProps {
  /** 演出中の表示用（確定前スナップショット） */
  displaySnapshot: StageData;
  /** レイアウト計算用（最新スナップショット） */
  layoutSnapshot: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId?: Record<string, string[]>;
  currentMatchId: number | null;
  matchConfirmed: Extract<RealtimeEvent, { type: 'match:confirmed' }> | null;
  skipSignal: number;
  onMatchConfirmedConsumed: () => void;
  onEffectComplete: () => void;
}

export default function EffectOrchestrator({
  displaySnapshot,
  layoutSnapshot,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId = {},
  currentMatchId,
  matchConfirmed,
  skipSignal,
  onMatchConfirmedConsumed,
  onEffectComplete,
}: EffectOrchestratorProps) {
  const {
    activeEffect,
    startEffect,
    finishEffect,
    handleSkip,
    registerTimelineKill,
    winnerLabel,
    winnerFaces,
    winnerBracketLabel,
    teamALabel,
    teamBLabel,
    teamAFaces,
    teamBFaces,
    bracketLabel,
  } = useMatchEffect({
    snapshot: layoutSnapshot,
    faceUrlByTeamId,
    labelByTeamId,
    onComplete: onEffectComplete,
  });

  useEffect(() => {
    void ensurePresentationPreloaded(Object.values(faceUrlByTeamId).flat());
  }, [faceUrlByTeamId]);

  useEffect(() => {
    if (!matchConfirmed) return;
    void startEffect(matchConfirmed).finally(onMatchConfirmedConsumed);
  }, [matchConfirmed, startEffect, onMatchConfirmedConsumed]);

  useEffect(() => {
    if (skipSignal > 0) handleSkip();
  }, [skipSignal, handleSkip]);

  if (activeEffect) {
    return (
      <PresentationStage
        activeEffect={activeEffect}
        frozenSnapshot={displaySnapshot}
        updatedSnapshot={layoutSnapshot}
        faceUrlByTeamId={faceUrlByTeamId}
        labelByTeamId={labelByTeamId}
        memberNamesByTeamId={memberNamesByTeamId}
        currentMatchId={currentMatchId}
        winnerLabel={winnerLabel}
        winnerFaces={winnerFaces}
        winnerBracketLabel={winnerBracketLabel}
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        teamAFaces={teamAFaces}
        teamBFaces={teamBFaces}
        bracketLabel={bracketLabel}
        onComplete={finishEffect}
        onTimelineReady={registerTimelineKill}
      />
    );
  }

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center">
      <BracketView
        data={displaySnapshot}
        faceUrlByTeamId={faceUrlByTeamId}
        labelByTeamId={labelByTeamId}
        memberNamesByTeamId={memberNamesByTeamId}
        currentMatchId={currentMatchId}
      />
    </div>
  );
}
