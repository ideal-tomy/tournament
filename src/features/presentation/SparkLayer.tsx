import type { Ref } from 'react';

interface SparkLayerProps {
  sparkRef: Ref<HTMLDivElement>;
  xPercent: number;
  yPercent: number;
}

/** ブラケット接合点の控えめスパーク — opacity は timeline が制御 */
export default function SparkLayer({ sparkRef, xPercent, yPercent }: SparkLayerProps) {
  return (
    <div
      ref={sparkRef}
      className="effect-explosion pointer-events-none absolute z-30 flex items-center justify-center opacity-0"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <div className="effect-flame-burst-mini" />
      <div className="effect-flame-burst-mini effect-flame-burst-mini-delay" />
    </div>
  );
}
