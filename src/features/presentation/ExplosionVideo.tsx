import type { Ref } from 'react';
import { HIT_EXPLOSION_WEBM } from '../../lib/media';

const SIZE_CLASS = {
  sm: 'w-28 h-28',
  md: 'w-48 h-48',
  lg: 'w-[min(72vw,560px)] h-[min(72vw,560px)]',
  xl: 'w-[min(92vw,880px)] h-[min(92vw,880px)]',
} as const;

export type ExplosionVideoSize = keyof typeof SIZE_CLASS;

interface ExplosionVideoProps {
  wrapRef: Ref<HTMLDivElement>;
  videoRef: Ref<HTMLVideoElement>;
  size?: ExplosionVideoSize;
  className?: string;
}

/** 衝突点に重ねるアルファ WebM — 再生は timeline の fireExplosion のみ */
export default function ExplosionVideo({
  wrapRef,
  videoRef,
  size = 'xl',
  className = '',
}: ExplosionVideoProps) {
  return (
    <div
      ref={wrapRef}
      className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[52] pointer-events-none opacity-0 will-change-transform ${className}`}
      aria-hidden
    >
      <video
        ref={videoRef}
        src={HIT_EXPLOSION_WEBM}
        className={`object-contain mix-blend-screen drop-shadow-[0_0_48px_rgba(255,200,80,0.45)] ${SIZE_CLASS[size]}`}
        muted
        playsInline
        loop={false}
        preload="auto"
      />
    </div>
  );
}
