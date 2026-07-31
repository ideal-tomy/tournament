/**
 * 旧 broadcast 演出パス（DisplayEffectPanel）は v2 で非推奨。
 * Demo / Display は event_state シーン駆動に移行済み。
 * 型エラー回避のための薄い互換スタブ。
 */
import { useBracketDisplay } from '../bracket/useBracketDisplay';
import type { ConnectionStatus } from '../../lib/realtime';

export function useDisplayEffects(eventId: string | undefined) {
  const bracket = useBracketDisplay(eventId);
  return {
    ...bracket,
    matchConfirmed: null,
    skipSignal: 0,
    connectionStatus: 'connected' as ConnectionStatus,
    mediaReady: true,
    displaySnapshot: bracket.snapshot,
    handleEffectComplete: () => undefined,
    clearMatchConfirmed: () => undefined,
    queueMatchConfirmed: () => undefined,
    triggerEffectSkip: () => undefined,
  };
}

export function DisplayEffectPanel(_props: {
  eventId: string;
  className?: string;
  onRegisterTriggers?: (t: {
    queueMatchConfirmed: (p: unknown) => void;
    triggerEffectSkip: () => void;
  }) => void;
}) {
  return (
    <div className="flex h-full items-center justify-center text-slate-500 text-sm p-4">
      Display は /display を開いてください（シーン状態機械）
    </div>
  );
}
