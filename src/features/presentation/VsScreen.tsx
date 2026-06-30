import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import TeamShowcase from './TeamShowcase';
import { EFFECT_EASING } from './effectConstants';

interface VsScreenProps {
  visible: boolean;
  closing: boolean;
  teamALabel: string;
  teamBLabel: string;
  teamAFaces: string[];
  teamBFaces: string[];
  bracketLabel: string;
}

export default function VsScreen({
  visible,
  closing,
  teamALabel,
  teamBLabel,
  teamAFaces,
  teamBFaces,
  bracketLabel,
}: VsScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !rootRef.current || !vsRef.current) return;

    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.7, ease: 'power2.out' },
    );
    if (rowRef.current) {
      gsap.fromTo(
        rowRef.current,
        { scale: 0.15, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.95, ease: EFFECT_EASING.vsIn, delay: 0.15 },
      );
    }
    gsap.fromTo(
      vsRef.current,
      { scale: 0, opacity: 0, rotation: -20 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.85,
        ease: EFFECT_EASING.vsIn,
        delay: 0.35,
      },
    );
  }, [visible]);

  useEffect(() => {
    if (!closing || !rootRef.current) return;
    gsap.to(rootRef.current, {
      opacity: 0,
      duration: 0.7,
      ease: EFFECT_EASING.vsOut,
    });
  }, [closing]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-label="対戦画面"
    >
      <p className="text-fuchsia-400 text-sm font-black tracking-[0.2em] mb-8 uppercase">
        {bracketLabel}
      </p>

      <div
        ref={rowRef}
        className="flex items-center justify-center gap-6 md:gap-16 w-full max-w-5xl px-6"
      >
        <TeamShowcase label={teamALabel} faces={teamAFaces} accent="cyan" size="lg" />
        <div
          ref={vsRef}
          className="text-7xl md:text-9xl font-black text-yellow-300 drop-shadow-[0_0_32px_rgba(250,204,21,0.95)] shrink-0"
        >
          VS
        </div>
        <TeamShowcase label={teamBLabel} faces={teamBFaces} accent="rose" size="lg" />
      </div>
    </div>
  );
}
