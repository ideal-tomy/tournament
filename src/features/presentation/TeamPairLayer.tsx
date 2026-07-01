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

/** 対戦者接近 / VS — 3カラムで VS と顔が重ならない */
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
        className="relative z-10 flex flex-col items-center mb-8 opacity-0"
      >
        <p className="text-amber-300 text-xs md:text-sm font-black tracking-[0.25em] uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {bracketLabel}
        </p>
        <p className="text-white/90 text-sm md:text-base font-bold tracking-widest mt-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          NEXT MATCH — 対戦確定
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-8 w-full max-w-6xl px-4 min-h-[300px]">
        <div ref={leftRef} className="flex justify-end opacity-0 will-change-transform">
          <TeamShowcase label={teamALabel} faces={teamAFaces} accent="cyan" size="lg" facesOnly />
        </div>

        <div
          ref={vsRef}
          className="flex items-center justify-center px-3 md:px-6 opacity-0 will-change-transform"
        >
          <span className="text-6xl md:text-8xl font-black text-yellow-300 drop-shadow-[0_0_32px_rgba(250,204,21,0.95)] leading-none select-none">
            VS
          </span>
        </div>

        <div ref={rightRef} className="flex justify-start opacity-0 will-change-transform">
          <TeamShowcase label={teamBLabel} faces={teamBFaces} accent="rose" size="lg" facesOnly />
        </div>
      </div>
    </div>
  );
}
