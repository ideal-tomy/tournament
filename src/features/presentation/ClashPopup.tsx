import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import TeamShowcase from './TeamShowcase';
import { EFFECT_EASING, EFFECT_TIMING } from './effectConstants';

export type ClashPhase = 'approach' | 'impact' | 'hidden';

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
  const burstRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (phase !== 'approach' || !leftRef.current || !rightRef.current || !rootRef.current) {
      return;
    }

    const dur = EFFECT_TIMING.clashApproach;
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    if (labelRef.current) {
      gsap.fromTo(
        labelRef.current,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
      );
    }
    gsap.fromTo(
      leftRef.current,
      { x: '-130%', scale: 0.3, opacity: 0 },
      { x: '-12%', scale: 1.1, opacity: 1, duration: dur, ease: EFFECT_EASING.clash },
    );
    gsap.fromTo(
      rightRef.current,
      { x: '130%', scale: 0.3, opacity: 0 },
      { x: '12%', scale: 1.1, opacity: 1, duration: dur, ease: EFFECT_EASING.clash },
    );
  }, [phase]);

  useEffect(() => {
    if (phase !== 'impact' || !leftRef.current || !rightRef.current) return;

    const impactDur = EFFECT_TIMING.collisionFlash * 0.45;
    gsap.to([leftRef.current, rightRef.current], {
      x: 0,
      scale: 1.4,
      duration: impactDur,
      ease: EFFECT_EASING.impact,
    });
    gsap.to([leftRef.current, rightRef.current], {
      opacity: 0,
      scale: 0.2,
      duration: EFFECT_TIMING.collisionFlash * 0.55,
      delay: impactDur,
      ease: 'power2.in',
    });
    if (burstRef.current) {
      gsap.fromTo(
        burstRef.current,
        { scale: 0.15, opacity: 1 },
        { scale: 2.8, opacity: 0, duration: EFFECT_TIMING.collisionFlash, ease: 'power2.out' },
      );
    }
    if (rootRef.current) {
      gsap.to(rootRef.current, {
        keyframes: [
          { scale: 1.05, duration: 0.1 },
          { scale: 1, duration: 0.15 },
        ],
      });
    }
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden"
      role="dialog"
      aria-label="対戦確定"
    >
      <p className="text-amber-300 text-xs md:text-sm font-black tracking-[0.25em] mb-4 uppercase z-10">
        {bracketLabel}
      </p>
      <p
        ref={labelRef}
        className="text-white/80 text-sm md:text-base font-bold tracking-widest mb-10 z-10"
      >
        NEXT MATCH — 対戦確定
      </p>

      <div className="relative flex items-center justify-center gap-4 md:gap-12 w-full max-w-5xl px-4 min-h-[280px]">
        <div ref={leftRef} className="flex-1 flex justify-end z-10">
          <TeamShowcase label={teamALabel} faces={teamAFaces} accent="cyan" size="xl" />
        </div>

        <div ref={rightRef} className="flex-1 flex justify-start z-10">
          <TeamShowcase label={teamBLabel} faces={teamBFaces} accent="rose" size="xl" />
        </div>

        <div
          ref={burstRef}
          className={`effect-clash-burst pointer-events-none ${phase === 'impact' ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
