import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import TeamShowcase from './TeamShowcase';
import { EFFECT_EASING } from './effectConstants';

interface WinnerCelebratePopupProps {
  visible: boolean;
  closing: boolean;
  teamLabel: string;
  faces: string[];
  bracketLabel: string;
}

export default function WinnerCelebratePopup({
  visible,
  closing,
  teamLabel,
  faces,
  bracketLabel,
}: WinnerCelebratePopupProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !rootRef.current) return;

    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    if (raysRef.current) {
      gsap.fromTo(
        raysRef.current,
        { scale: 0.5, opacity: 0, rotation: -30 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.8, ease: 'power2.out' },
      );
    }
    if (badgeRef.current) {
      gsap.fromTo(
        badgeRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: EFFECT_EASING.vsIn, delay: 0.05 },
      );
    }
    if (teamRef.current) {
      gsap.fromTo(
        teamRef.current,
        { scale: 0.4, opacity: 0, y: 40 },
        { scale: 1, opacity: 1, y: 0, duration: 0.65, ease: EFFECT_EASING.vsIn, delay: 0.15 },
      );
    }
  }, [visible]);

  useEffect(() => {
    if (!closing || !rootRef.current) return;
    gsap.to(rootRef.current, { opacity: 0, duration: 0.35, ease: EFFECT_EASING.vsOut });
  }, [closing]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-md overflow-hidden"
      role="dialog"
      aria-label="勝利チーム"
    >
      <div ref={raysRef} className="effect-winner-rays pointer-events-none" aria-hidden />
      <div className="effect-confetti pointer-events-none" aria-hidden />

      <p className="text-fuchsia-400 text-xs md:text-sm font-black tracking-[0.25em] mb-6 uppercase z-10">
        {bracketLabel}
      </p>

      <div
        ref={badgeRef}
        className="effect-winner-badge text-5xl md:text-7xl font-black text-yellow-300 mb-8 z-10"
      >
        WIN!
      </div>

      <div ref={teamRef} className="z-10">
        <TeamShowcase label={teamLabel} faces={faces} accent="gold" size="xl" />
      </div>

      <p className="mt-8 text-cyan-300/90 text-sm md:text-base font-bold tracking-widest z-10">
        勝利 — WINNER
      </p>
    </div>
  );
}
