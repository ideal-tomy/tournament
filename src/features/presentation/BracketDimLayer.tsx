import type { Ref } from 'react';

interface BracketDimLayerProps {
  dimRef: Ref<HTMLDivElement>;
}

/** 演出中 — 背景ブラケットをぼかし＋暗くして前面演出を際立たせる */
export default function BracketDimLayer({ dimRef }: BracketDimLayerProps) {
  return (
    <div
      ref={dimRef}
      className="absolute inset-0 z-[12] bg-black/55 backdrop-blur-md opacity-0 pointer-events-none"
      aria-hidden
    />
  );
}
