import type { Ref } from 'react';
import TeamShowcase from './TeamShowcase';

interface TeamPairLayerProps {
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketLabel: string;
  clashLabelsRef: Ref<HTMLDivElement>;
  leftRef: Ref<HTMLDivElement>;
  rightRef: Ref<HTMLDivElement>;
  vsRef: Ref<HTMLDivElement>;
}

/** 対戦者接近 / VS — 背景は透過のまま（黒オーバーレイなし） */
export default function TeamPairLayer({
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketLabel,
  clashLabelsRef,
  leftRef,
  rightRef,
  vsRef,
}: TeamPairLayerProps) {
  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col items-center justify-center overflow-hidden pointer-events-none"
      aria-hidden
    >
      <div
        ref={clashLabelsRef}
        className="relative z-10 flex flex-col items-center mb-10 opacity-0"
      >
        <p className="text-amber-300 text-xs md:text-sm font-black tracking-[0.25em] uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {bracketLabel}
        </p>
        <p className="text-white/90 text-sm md:text-base font-bold tracking-widest mt-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          NEXT MATCH — 対戦確定
        </p>
      </div>

      <div className="relative flex items-center justify-center gap-4 md:gap-12 w-full max-w-5xl px-4 min-h-[280px]">
        <div ref={leftRef} className="flex-1 flex justify-end z-10 will-change-transform opacity-0">
          <TeamShowcase label={teamALabel} faces={teamAFaces} accent="cyan" size="xl" facesOnly />
        </div>

        <div
          ref={vsRef}
          className="absolute left-1/2 top-1/2 text-7xl md:text-9xl font-black text-yellow-300 drop-shadow-[0_0_32px_rgba(250,204,21,0.95)] shrink-0 z-30 opacity-0 pointer-events-none -translate-x-1/2 -translate-y-1/2 will-change-transform"
        >
          VS
        </div>

        <div ref={rightRef} className="flex-1 flex justify-start z-10 will-change-transform opacity-0">
          <TeamShowcase label={teamBLabel} faces={teamBFaces} accent="rose" size="xl" facesOnly />
        </div>
      </div>
    </div>
  );
}
