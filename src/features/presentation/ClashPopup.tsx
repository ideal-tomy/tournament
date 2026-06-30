import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import TeamShowcase from './TeamShowcase';
import { EFFECT_EASING } from './effectConstants';

export type ClashPhase = 'approach' | 'impact' | 'explosion' | 'hidden';

interface ClashPopupProps {
  phase: ClashPhase;
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketLabel: string;
}

export default function ClashPopup({
  phase,
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketLabel,
}: ClashPopupProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== 'approach' || !leftRef.current || !rightRef.current || !rootRef.current) {
      return;
    }

    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(
      leftRef.current,
      { x: '-120%', scale: 0.35, opacity: 0 },
      { x: '-8%', scale: 1.15, opacity: 1, duration: 0.85, ease: 'power3.out' },
    );
    gsap.fromTo(
      rightRef.current,
      { x: '120%', scale: 0.35, opacity: 0 },
      { x: '8%', scale: 1.15, opacity: 1, duration: 0.85, ease: 'power3.out' },
    );
    if (vsRef.current) {
      gsap.fromTo(
        vsRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: EFFECT_EASING.vsIn, delay: 0.5 },
      );
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'impact' && phase !== 'explosion') return;
    if (!leftRef.current || !rightRef.current) return;

    gsap.to([leftRef.current, rightRef.current], {
      x: 0,
      scale: 1.35,
      duration: 0.18,
      ease: 'power4.in',
    });
    if (burstRef.current) {
      gsap.fromTo(
        burstRef.current,
        { scale: 0.2, opacity: 1 },
        { scale: 2.2, opacity: 0, duration: 0.55, ease: 'power2.out' },
      );
    }
    if (rootRef.current) {
      gsap.to(rootRef.current, {
        keyframes: [
          { scale: 1.04, duration: 0.06 },
          { scale: 1, duration: 0.12 },
        ],
      });
    }
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-black/88 backdrop-blur-md overflow-hidden"
      role="dialog"
      aria-label="対戦確定"
    >
      <p className="text-amber-300 text-xs md:text-sm font-black tracking-[0.25em] mb-6 uppercase z-10">
        {bracketLabel}
      </p>
      <p className="text-white/80 text-sm md:text-base font-bold tracking-widest mb-8 z-10">
        NEXT MATCH — 対戦確定
      </p>

      <div className="relative flex items-center justify-center gap-2 md:gap-6 w-full max-w-6xl px-4 min-h-[280px]">
        <div ref={leftRef} className="flex-1 flex justify-end z-10">
          <TeamShowcase label={teamALabel} faces={teamAFaces} accent="cyan" size="xl" />
        </div>

        <div
          ref={vsRef}
          className="text-5xl md:text-8xl font-black text-yellow-300 shrink-0 z-20 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)]"
        >
          VS
        </div>

        <div ref={rightRef} className="flex-1 flex justify-start z-10">
          <TeamShowcase label={teamBLabel} faces={teamBFaces} accent="rose" size="xl" />
        </div>

        <div
          ref={burstRef}
          className={`effect-clash-burst pointer-events-none ${phase === 'impact' || phase === 'explosion' ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        />
      </div>

      {(phase === 'impact' || phase === 'explosion') && (
        <div className="effect-confetti pointer-events-none" aria-hidden />
      )}
    </div>
  );
}
