interface ExplosionLayerProps {
  /** コンテナ内 0–100% */
  xPercent: number;
  yPercent: number;
  active: boolean;
}

/** WebM 未配置時は CSS バースト（GSAP タイムラインと同期） */
export default function ExplosionLayer({ xPercent, yPercent, active }: ExplosionLayerProps) {
  if (!active) return null;

  return (
    <div
      className="effect-explosion pointer-events-none absolute z-30"
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      <div className="effect-explosion-core" />
      <div className="effect-explosion-ring" />
      <div className="effect-explosion-ring effect-explosion-ring-delay" />
    </div>
  );
}
