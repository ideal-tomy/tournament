import type { MatchEffectLayout } from './resolveEffectLayout';

interface LineCollisionProps {
  layout: MatchEffectLayout;
  progress: number;
  flash: boolean;
}

export default function LineCollision({ layout, progress, flash }: LineCollisionProps) {
  const { slotA, slotB, collision } = layout;
  const endA = {
    x: slotA.x + (collision.x - slotA.x) * progress,
    y: slotA.y + (collision.y - slotA.y) * progress,
  };
  const endB = {
    x: slotB.x + (collision.x - slotB.x) * progress,
    y: slotB.y + (collision.y - slotB.y) * progress,
  };

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
    </g>
  );
}
