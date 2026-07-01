import type { Ref } from 'react';

interface ReturnFlashLayerProps {
  flashRef: Ref<HTMLDivElement>;
  flashBurstRef: Ref<HTMLDivElement>;
  flashRingRef: Ref<HTMLDivElement>;
}

/** 表復帰 — 中心から外へ広がる光（GSAP が scale / opacity を制御） */
export default function ReturnFlashLayer({
  flashRef,
  flashBurstRef,
  flashRingRef,
}: ReturnFlashLayerProps) {
  return (
    <div
      ref={flashRef}
      className="effect-return-flash-stage fixed inset-0 z-[55] pointer-events-none opacity-0 overflow-hidden"
      aria-hidden
    >
      <div ref={flashRingRef} className="effect-return-light-ring" />
      <div ref={flashBurstRef} className="effect-return-light-burst" />
    </div>
  );
}
