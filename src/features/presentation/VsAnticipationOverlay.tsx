import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { EFFECT_TIMING } from './effectConstants';

interface VsAnticipationOverlayProps {
  active: boolean;
}

/** 衝突後 → 炎爆発前 — エネルギー蓄積・予感 */
export default function VsAnticipationOverlay({ active }: VsAnticipationOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const dur = EFFECT_TIMING.vsAnticipation;

  useEffect(() => {
    if (!active || !rootRef.current) return;

    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    if (coreRef.current) {
      gsap.fromTo(
        coreRef.current,
        { scale: 0.2, opacity: 0.3 },
        {
          scale: 1.35,
          opacity: 1,
          duration: dur * 0.85,
          ease: 'power2.in',
        },
      );
    }
    if (hintRef.current) {
      gsap.fromTo(
        hintRef.current,
        { opacity: 0, letterSpacing: '0.5em' },
        {
          opacity: 1,
          letterSpacing: '0.15em',
          duration: dur * 0.5,
          ease: 'power1.out',
          delay: dur * 0.15,
        },
      );
    }
  }, [active, dur]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[47] pointer-events-none flex flex-col items-center justify-center overflow-hidden bg-black/92"
      aria-hidden
    >
      <div className="effect-anticipation-vignette absolute inset-0" />
      <div className="effect-anticipation-sparks absolute inset-0" />

      <div className="effect-anticipation-ring effect-anticipation-ring-1" />
      <div className="effect-anticipation-ring effect-anticipation-ring-2" />
      <div className="effect-anticipation-ring effect-anticipation-ring-3" />

      <div ref={coreRef} className="effect-anticipation-core relative z-10">
        <div className="effect-anticipation-core-inner" />
        <div className="effect-anticipation-core-glow" />
      </div>

      <p
        ref={hintRef}
        className="relative z-10 mt-16 text-amber-200/90 text-sm md:text-base font-black tracking-widest effect-anticipation-pulse"
      >
        NEXT BATTLE
      </p>

      <div className="effect-anticipation-ember-hint absolute bottom-0 left-0 right-0 h-32 z-0" />
    </div>
  );
}
