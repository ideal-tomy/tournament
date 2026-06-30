import { useEffect, useRef } from 'react';
import BracketView from '../bracket/BracketView';
import type { StageData } from '../bracket/layout';
import type { RealtimeEvent } from '../../types';
import ClashPopup from './ClashPopup';
import ExplosionLayer from './ExplosionLayer';
import FlameBurstOverlay from './FlameBurstOverlay';
import LineCollision from './LineCollision';
import VsAnticipationOverlay from './VsAnticipationOverlay';
import VsScreen from './VsScreen';
import WinnerCelebratePopup from './WinnerCelebratePopup';
import { useMatchEffect } from './useMatchEffect';
import { ensurePresentationPreloaded } from './preloadPresentation';

interface EffectOrchestratorProps {
  snapshot: StageData | null;
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
  snapshot,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId = {},
  currentMatchId,
  matchConfirmed,
  skipSignal,
  onMatchConfirmedConsumed,
  onEffectComplete,
}: EffectOrchestratorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
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
    winnerLabel,
    winnerFaces,
    winnerBracketLabel,
    teamALabel,
    teamBLabel,
    teamAFaces,
    teamBFaces,
    bracketLabel,
  } = useMatchEffect({
    snapshot,
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

  const layout = active?.layout;
  const suspenseShake =
    isPlaying &&
    hasAdvance &&
    (phase === 'flash' || phase === 'vsAnticipation' || phase === 'vsFlameBurst');

  return (
    <>
      <div
        ref={containerRef}
        className={`relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center transition-opacity duration-700 ${
          dimmed ? 'opacity-25 scale-[0.98]' : ''
        } ${suspenseShake ? 'effect-shake' : ''}`}
      >
        {snapshot && (
          <BracketView
            data={snapshot}
            faceUrlByTeamId={faceUrlByTeamId}
            labelByTeamId={labelByTeamId}
            memberNamesByTeamId={memberNamesByTeamId}
            currentMatchId={isPlaying && hasAdvance ? null : currentMatchId}
          />
        )}

        {layout && showBracketOverlay && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="effect-line-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <LineCollision
              layout={layout}
              progress={lineProgress}
              flash={showFlash}
            />
          </svg>
        )}

        {layout && showBracketExplosion && (
          <ExplosionLayer
            xPercent={explosionPercent.x}
            yPercent={explosionPercent.y}
            active={showBracketExplosion}
            variant="flame"
          />
        )}
      </div>

      <VsAnticipationOverlay active={vsAnticipationVisible} />
      <FlameBurstOverlay active={vsFlameBurstVisible} />

      <WinnerCelebratePopup
        visible={winnerVisible}
        closing={winnerClosing}
        teamLabel={winnerLabel}
        faces={winnerFaces}
        bracketLabel={winnerBracketLabel}
      />

      {hasAdvance && (
        <ClashPopup
          phase={clashPhase}
          teamALabel={teamALabel}
          teamBLabel={teamBLabel}
          teamAFaces={teamAFaces}
          teamBFaces={teamBFaces}
          bracketLabel={bracketLabel}
        />
      )}

      <VsScreen
        visible={vsVisible}
        closing={vsClosing}
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        teamAFaces={teamAFaces}
        teamBFaces={teamBFaces}
        bracketLabel={bracketLabel}
      />
    </>
  );
}
