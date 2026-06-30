import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const FLAME_COUNT = 14;

interface FlameBurstOverlayProps {
  active: boolean;
}

/** VS 直前 — 炎が燃え上がる爆発 */
export default function FlameBurstOverlay({ active }: FlameBurstOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !rootRef.current) return;

    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.12 });
    if (pillarRef.current) {
      gsap.fromTo(
        pillarRef.current,
        { scaleY: 0.05, scaleX: 0.4, opacity: 0.6 },
        { scaleY: 1.2, scaleX: 1.1, opacity: 1, duration: 0.45, ease: 'power3.out' },
      );
      gsap.to(pillarRef.current, {
        scaleY: 1.6,
        scaleX: 1.4,
        opacity: 0,
        duration: 0.75,
        delay: 0.35,
        ease: 'power2.in',
      });
    }
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[48] pointer-events-none overflow-hidden effect-flame-burst-shake"
      aria-hidden
    >
      <div className="effect-flame-heat absolute inset-0" />
      <div className="effect-flame-flash absolute inset-0" />

      <div className="effect-flame-field absolute inset-x-0 bottom-0 h-[70vh] flex items-end justify-center">
        {Array.from({ length: FLAME_COUNT }, (_, i) => (
          <div
            key={i}
            className="effect-flame-tongue"
            style={{ '--fi': i, '--fc': FLAME_COUNT } as CSSProperties}
          />
        ))}
      </div>

      <div className="effect-flame-field absolute inset-0 flex items-center justify-center">
        <div ref={pillarRef} className="effect-flame-pillar origin-bottom" />
      </div>

      <div className="effect-ember-rise absolute inset-0" />
    </div>
  );
}
