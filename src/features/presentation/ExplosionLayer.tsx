interface ExplosionLayerProps {
  /** コンテナ内 0–100% */
  xPercent: number;
  yPercent: number;
  active: boolean;
  variant?: 'default' | 'flame';
}

/** WebM 未配置時は CSS バースト（GSAP タイムラインと同期） */
export default function ExplosionLayer({
  xPercent,
  yPercent,
  active,
  variant = 'default',
}: ExplosionLayerProps) {
  if (!active) return null;

  const isFlame = variant === 'flame';

  return (
    <div
      className={`effect-explosion pointer-events-none absolute z-30 ${isFlame ? 'effect-explosion-flame' : ''}`}
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
      }}
      aria-hidden
    >
      {isFlame ? (
        <>
          <div className="effect-flame-burst-mini" />
          <div className="effect-flame-burst-mini effect-flame-burst-mini-delay" />
        </>
      ) : (
        <>
          <div className="effect-explosion-core" />
          <div className="effect-explosion-ring" />
          <div className="effect-explosion-ring effect-explosion-ring-delay" />
        </>
      )}
    </div>
  );
}
