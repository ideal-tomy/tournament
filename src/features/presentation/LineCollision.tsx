import type { MatchEffectLayout } from './resolveEffectLayout';

interface LineCollisionProps {
  layout: MatchEffectLayout;
  progress: number;
  flash: boolean;
}

export default function LineCollision({ layout, progress, flash }: LineCollisionProps) {
  const { slotA, slotB, collision, junctionY } = layout;

  const endA = {
    x: slotA.x,
    y: slotA.y + (junctionY - slotA.y) * progress,
  };
  const endB = {
    x: slotB.x,
    y: slotB.y + (junctionY - slotB.y) * progress,
  };

  const bridgeProgress = Math.min(1, Math.max(0, (progress - 0.92) / 0.08));
  const bridgeLeft = endA.x + (collision.x - endA.x) * bridgeProgress;
  const bridgeRight = endB.x + (collision.x - endB.x) * bridgeProgress;

  return (
    <g className={flash ? 'effect-collision-flash' : undefined}>
      {flash && (
        <circle
          cx={collision.x}
          cy={collision.y}
          r={48}
          fill="white"
          opacity={0.85}
        />
      )}
      <line
        x1={slotA.x}
        y1={slotA.y}
        x2={endA.x}
        y2={endA.y}
        stroke="#22d3ee"
        strokeWidth={4}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
      <line
        x1={slotB.x}
        y1={slotB.y}
        x2={endB.x}
        y2={endB.y}
        stroke="#f472b6"
        strokeWidth={4}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
      {bridgeProgress > 0 && (
        <line
          x1={bridgeLeft}
          y1={junctionY}
          x2={bridgeRight}
          y2={junctionY}
          stroke="#fde047"
          strokeWidth={3}
          strokeLinecap="round"
          filter="url(#effect-line-glow)"
        />
      )}
    </g>
  );
}
