import { useCallback, useRef } from 'react';
import BracketView from '../bracket/BracketView';
import type { StageData } from '../bracket/layout';
import ExplosionVideo from './ExplosionVideo';
import LineCollision from './LineCollision';
import ReturnFlashLayer from './ReturnFlashLayer';
import SparkLayer from './SparkLayer';
import TeamPairLayer from './TeamPairLayer';
import WinnerLayer from './WinnerLayer';
import type { ActiveEffect } from './useMatchEffect';
import { usePresentationTimeline } from './usePresentationTimeline';
import type { StageRefObjects } from './timeline';
import { viewBoxToPercent } from './resolveEffectLayout';

interface PresentationStageProps {
  activeEffect: ActiveEffect;
  frozenSnapshot: StageData;
  updatedSnapshot: StageData;
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId: Record<string, string[]>;
  currentMatchId: number | null;
  winnerLabel: string;
  winnerFaces: string[];
  winnerBracketLabel: string;
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketLabel: string;
  onComplete: () => void;
  onTimelineReady: (kill: () => void) => void;
}

export default function PresentationStage({
  activeEffect,
  frozenSnapshot,
  updatedSnapshot,
  faceUrlByTeamId,
  labelByTeamId,
  memberNamesByTeamId,
  currentMatchId,
  winnerLabel,
  winnerFaces,
  winnerBracketLabel,
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketLabel,
  onComplete,
  onTimelineReady,
}: PresentationStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<SVGGElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const teamBackdropRef = useRef<HTMLDivElement>(null);
  const clashLabelsRef = useRef<HTMLDivElement>(null);
  const explosionWrapRef = useRef<HTMLDivElement>(null);
  const explosionVideoRef = useRef<HTMLVideoElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const bracketUpdatedRef = useRef<HTMLDivElement>(null);
  const bracketFrozenRef = useRef<HTMLDivElement>(null);

  const refs: StageRefObjects = {
    winner: winnerRef,
    bar: barRef,
    left: leftRef,
    right: rightRef,
    vs: vsRef,
    teamBackdrop: teamBackdropRef,
    clashLabels: clashLabelsRef,
    explosionWrap: explosionWrapRef,
    explosionVideo: explosionVideoRef,
    spark: sparkRef,
    flash: flashRef,
    bracketUpdated: bracketUpdatedRef,
    bracketFrozen: bracketFrozenRef,
  };

  const fireExplosion = useCallback(() => {
    const v = explosionVideoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play();
  }, []);

  usePresentationTimeline(
    stageRef,
    refs,
    { matchId: activeEffect.matchId, advance: activeEffect.advance },
    fireExplosion,
    onComplete,
    onTimelineReady,
  );

  const layout = activeEffect.layout;
  const sparkPercent =
    layout != null
      ? viewBoxToPercent(layout.collision, layout.viewBox)
      : { x: 50, y: 50 };

  return (
    <div
      ref={stageRef}
      className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center"
    >
      <div ref={bracketFrozenRef} className="absolute inset-0 flex items-center justify-center">
        <BracketView
          data={frozenSnapshot}
          faceUrlByTeamId={faceUrlByTeamId}
          labelByTeamId={labelByTeamId}
          memberNamesByTeamId={memberNamesByTeamId}
          currentMatchId={null}
          suppressConnectorHighlight
        />
      </div>

      <div ref={bracketUpdatedRef} className="absolute inset-0 flex items-center justify-center opacity-0">
        <BracketView
          data={updatedSnapshot}
          faceUrlByTeamId={faceUrlByTeamId}
          labelByTeamId={labelByTeamId}
          memberNamesByTeamId={memberNamesByTeamId}
          currentMatchId={currentMatchId}
        />
      </div>

      {layout && (
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
          <LineCollision ref={barRef} layout={layout} />
        </svg>
      )}

      {layout && (
        <SparkLayer sparkRef={sparkRef} xPercent={sparkPercent.x} yPercent={sparkPercent.y} />
      )}

      <WinnerLayer
        rootRef={winnerRef}
        teamLabel={winnerLabel}
        faces={winnerFaces}
        bracketLabel={winnerBracketLabel}
      />

      <TeamPairLayer
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        teamAFaces={teamAFaces}
        teamBFaces={teamBFaces}
        bracketLabel={bracketLabel}
        teamBackdropRef={teamBackdropRef}
        clashLabelsRef={clashLabelsRef}
        leftRef={leftRef}
        rightRef={rightRef}
        vsRef={vsRef}
      />

      <ExplosionVideo wrapRef={explosionWrapRef} videoRef={explosionVideoRef} />

      <ReturnFlashLayer flashRef={flashRef} />
    </div>
  );
}
