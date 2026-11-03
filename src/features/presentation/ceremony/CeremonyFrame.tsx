import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import './ceremony.css';

export interface CeremonyTeam {
  name: string;
  members: string[];
  faces: string[];
}

/** 1920×1080 stage centered and scaled to its container. Backgrounds are CSS images so a missing file never trips photo error handling. */
export default function CeremonyFrame({ stageRef, className, label, contained = false, children }: {
  stageRef: RefObject<HTMLDivElement>;
  className: string;
  label: string;
  contained?: boolean;
  children: ReactNode;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = fitRef.current;
    const stage = stageRef.current;
    if (!fit || !stage) return;
    const apply = () => {
      const scale = Math.min(fit.clientWidth / 1920, fit.clientHeight / 1080);
      stage.style.transform = `translate(-50%, -50%) scale(${scale || 1})`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(fit);
    return () => observer.disconnect();
  }, [stageRef]);
  return <div ref={fitRef} className={`cer-fit${contained ? ' is-contained' : ''}`}>
    <div ref={stageRef} className={`cer-stage ${className}`} aria-label={label}>{children}</div>
  </div>;
}

/** Cards are laid out symmetrically around centerX; one member stays centered. */
export function cardSlots(count: number, width: number, gap: number, centerX = 960) {
  const total = count * width + Math.max(0, count - 1) * gap;
  return Array.from({ length: count }, (_, index) => centerX - total / 2 + index * (width + gap));
}

export function people(team: CeremonyTeam) {
  return team.members.map((name, index) => ({ name, face: team.faces[index] ?? '' }));
}
