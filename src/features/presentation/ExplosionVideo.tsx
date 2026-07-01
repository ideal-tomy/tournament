import type { Ref } from 'react';
import { HIT_EXPLOSION_WEBM } from '../../lib/media';

interface ExplosionVideoProps {
  wrapRef: Ref<HTMLDivElement>;
  videoRef: Ref<HTMLVideoElement>;
  className?: string;
}

/**
 * 透過 WebM 爆発 — 画面全体に cover 表示。
 * mix-blend-screen で動画内の黒を透過し、裏のブラケットが見える。
 */
export default function ExplosionVideo({ wrapRef, videoRef, className = '' }: ExplosionVideoProps) {
  return (
    <div
      ref={wrapRef}
      className={`fixed inset-0 z-[52] pointer-events-none opacity-0 ${className}`}
      aria-hidden
    >
      <video
        ref={videoRef}
        src={HIT_EXPLOSION_WEBM}
        className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
        muted
        playsInline
        loop={false}
        preload="auto"
      />
    </div>
  );
}
