import { forwardRef } from 'react';
import type { MatchEffectLayout } from './resolveEffectLayout';

interface LineCollisionProps {
  layout: MatchEffectLayout;
}

/** 棒上昇用 — 全長描画済み SVG group（GSAP scaleY で伸ばす） */
const LineCollision = forwardRef<SVGGElement, LineCollisionProps>(function LineCollision(
  { layout },
  ref,
) {
  const { slotA, slotB, collision, junctionY } = layout;

  return (
    <g ref={ref}>
      <line
        x1={slotA.x}
        y1={slotA.y}
        x2={slotA.x}
        y2={junctionY}
        stroke="#22d3ee"
        strokeWidth={4}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
      <line
        x1={slotB.x}
        y1={slotB.y}
        x2={slotB.x}
        y2={junctionY}
        stroke="#f472b6"
        strokeWidth={4}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
      <line
        x1={slotA.x}
        y1={junctionY}
        x2={collision.x}
        y2={junctionY}
        stroke="#fde047"
        strokeWidth={3}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
      <line
        x1={slotB.x}
        y1={junctionY}
        x2={collision.x}
        y2={junctionY}
        stroke="#fde047"
        strokeWidth={3}
        strokeLinecap="round"
        filter="url(#effect-line-glow)"
      />
    </g>
  );
});

export default LineCollision;
