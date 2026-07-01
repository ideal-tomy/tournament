import type { Ref } from 'react';

interface ReturnFlashLayerProps {
  flashRef: Ref<HTMLDivElement>;
}

/** 表復帰フラッシュ — opacity は timeline が制御 */
export default function ReturnFlashLayer({ flashRef }: ReturnFlashLayerProps) {
  return (
    <div
      ref={flashRef}
      className="effect-bracket-return-flash fixed inset-0 z-[55] pointer-events-none opacity-0"
      aria-hidden
    />
  );
}
