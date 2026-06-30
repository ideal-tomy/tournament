import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import placeholderFace from '../../assets/placeholder_face.svg';
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

  useEffect(() => {
    if (!visible || !rootRef.current || !vsRef.current) return;

    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.25, ease: 'power2.out' },
    );
    gsap.fromTo(
      vsRef.current,
      { scale: 0.3, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: EFFECT_EASING.vsIn, delay: 0.1 },
    );
  }, [visible]);

  useEffect(() => {
    if (!closing || !rootRef.current) return;
    gsap.to(rootRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: EFFECT_EASING.vsOut,
    });
  }, [closing]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-label="対戦画面"
    >
      <p className="text-fuchsia-400 text-sm font-black tracking-[0.2em] mb-8 uppercase">
        {bracketLabel}
      </p>

      <div className="flex items-center justify-center gap-6 md:gap-16 w-full max-w-5xl px-6">
        <TeamPanel label={teamALabel} faces={teamAFaces} accent="cyan" side="left" />
        <div
          ref={vsRef}
          className="text-7xl md:text-9xl font-black text-yellow-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.8)] shrink-0"
        >
          VS
        </div>
        <TeamPanel label={teamBLabel} faces={teamBFaces} accent="rose" side="right" />
      </div>
    </div>
  );
}

function TeamPanel({
  label,
  faces,
  accent,
  side,
}: {
  label: string;
  faces: string[];
  accent: 'cyan' | 'rose';
  side: 'left' | 'right';
}) {
  const border = accent === 'cyan' ? 'border-cyan-400 shadow-cyan-500/40' : 'border-rose-400 shadow-rose-500/40';
  const urls = faces.length > 0 ? faces : [placeholderFace];

  return (
    <div
      className={`flex-1 flex flex-col items-center gap-4 ${side === 'left' ? 'items-end md:items-center' : 'items-start md:items-center'}`}
    >
      <div className="flex gap-2 justify-center">
        {urls.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            className={`w-20 h-20 md:w-28 md:h-28 rounded-lg object-cover border-2 ${border} shadow-lg`}
          />
        ))}
      </div>
      <p className="text-xl md:text-3xl font-black text-white text-center max-w-xs leading-tight drop-shadow-lg">
        {label}
      </p>
    </div>
  );
}
