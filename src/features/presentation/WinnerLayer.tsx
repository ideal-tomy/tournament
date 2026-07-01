import type { Ref } from 'react';
import TeamShowcase from './TeamShowcase';

interface WinnerLayerProps {
  rootRef: Ref<HTMLDivElement>;
  teamLabel: string;
  faces: string[];
  bracketLabel: string;
}

/** WIN 表示 — アニメは timeline が root の opacity を制御 */
export default function WinnerLayer({
  rootRef,
  teamLabel,
  faces,
  bracketLabel,
}: WinnerLayerProps) {
  return (
    <div
      ref={rootRef}
      className="effect-layer-idle fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden opacity-0 pointer-events-none"
      role="dialog"
      aria-label="勝利チーム"
    >
      <div className="effect-dissolve-mask absolute inset-0 bg-black/92 backdrop-blur-md" />
      <div className="effect-winner-rays pointer-events-none" aria-hidden />
      <div className="effect-confetti pointer-events-none" aria-hidden />

      <p className="text-fuchsia-400 text-xs md:text-sm font-black tracking-[0.25em] mb-6 uppercase z-10">
        {bracketLabel}
      </p>

      <div className="effect-winner-badge text-5xl md:text-7xl font-black text-yellow-300 mb-8 z-10">
        WIN!
      </div>

      <div className="z-10">
        <TeamShowcase label={teamLabel} faces={faces} accent="gold" size="xl" />
      </div>

      <p className="mt-8 text-cyan-300/90 text-sm md:text-base font-bold tracking-widest z-10">
        勝利 — WINNER
      </p>
    </div>
  );
}
