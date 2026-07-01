import { useCallback, useEffect, useRef, useState } from 'react';
import { useBracketDisplay } from '../bracket/useBracketDisplay';
import EffectOrchestrator from '../presentation/EffectOrchestrator';
import type { StageData } from '../bracket/layout';
import { displayMediaPreloader } from '../../lib/media';
import {
  subscribeWithReconnect,
  type ConnectionStatus,
} from '../../lib/realtime';
import { bracketTheme } from '../../styles/bracketTheme';
import type { RealtimeEvent } from '../../types';

type MatchConfirmed = Extract<RealtimeEvent, { type: 'match:confirmed' }>;

export function useDisplayEffects(eventId: string | undefined) {
  const {
    snapshot,
    faceUrlByTeamId,
    labelByTeamId,
    memberNamesByTeamId,
    currentMatchId,
    hasBracket,
    loading: bracketLoading,
    error: bracketError,
    reload: reloadBracket,
  } = useBracketDisplay(eventId);

  const [matchConfirmed, setMatchConfirmed] = useState<MatchConfirmed | null>(null);
  const [pendingEffect, setPendingEffect] = useState<MatchConfirmed | null>(null);
  const [frozenSnapshot, setFrozenSnapshot] = useState<StageData | null>(null);
  const [skipSignal, setSkipSignal] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [mediaReady, setMediaReady] = useState(false);

  const effectPlayingRef = useRef(false);
  const pendingBracketReloadRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const displaySnapshot = frozenSnapshot ?? snapshot;

  useEffect(() => {
    let cancelled = false;
    void displayMediaPreloader.preloadDisplayAssets().then(() => {
      if (!cancelled) setMediaReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEffectComplete = useCallback(() => {
    effectPlayingRef.current = false;
    setFrozenSnapshot(null);
    if (pendingBracketReloadRef.current) {
      pendingBracketReloadRef.current = false;
      reloadBracket();
    }
  }, [reloadBracket]);

  useEffect(() => {
    if (!pendingEffect || bracketLoading || !snapshot) return;
    setMatchConfirmed(pendingEffect);
    setPendingEffect(null);
  }, [pendingEffect, snapshot, bracketLoading]);

  const queueMatchConfirmed = useCallback(
    (payload: MatchConfirmed) => {
      effectPlayingRef.current = true;
      if (snapshotRef.current) {
        setFrozenSnapshot(snapshotRef.current);
      }
      setPendingEffect(payload);
      reloadBracket();
    },
    [reloadBracket],
  );

  const triggerEffectSkip = useCallback(() => {
    setSkipSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    return subscribeWithReconnect(eventId, {
      onEvent: (payload) => {
        if (payload.type === 'bracket:updated') {
          if (effectPlayingRef.current) {
            pendingBracketReloadRef.current = true;
          } else {
            reloadBracket();
          }
        }
        if (payload.type === 'match:confirmed') {
          queueMatchConfirmed(payload);
        }
        if (payload.type === 'effect:skip') {
          triggerEffectSkip();
        }
      },
      onStatus: setConnectionStatus,
    });
  }, [eventId, reloadBracket, queueMatchConfirmed, triggerEffectSkip]);

  const isLoading = bracketLoading || !mediaReady;

  return {
    snapshot,
    displaySnapshot,
    faceUrlByTeamId,
    labelByTeamId,
    memberNamesByTeamId,
    currentMatchId,
    hasBracket,
    isLoading,
    bracketError,
    matchConfirmed,
    skipSignal,
    connectionStatus,
    queueMatchConfirmed,
    triggerEffectSkip,
    handleEffectComplete,
    onMatchConfirmedConsumed: () => setMatchConfirmed(null),
    bracketThemeBackground: bracketTheme.background,
  };
}

interface DisplayEffectPanelProps {
  eventId: string;
  className?: string;
  /** 同一ページの操作端から直接演出を起動（Realtime self:false 回避） */
  onRegisterTriggers?: (triggers: {
    queueMatchConfirmed: (payload: MatchConfirmed) => void;
    triggerEffectSkip: () => void;
  }) => void;
}

export function DisplayEffectPanel({
  eventId,
  className = '',
  onRegisterTriggers,
}: DisplayEffectPanelProps) {
  const fx = useDisplayEffects(eventId);

  useEffect(() => {
    onRegisterTriggers?.({
      queueMatchConfirmed: fx.queueMatchConfirmed,
      triggerEffectSkip: fx.triggerEffectSkip,
    });
  }, [onRegisterTriggers, fx.queueMatchConfirmed, fx.triggerEffectSkip]);

  return (
    <div
      className={`flex flex-col min-h-0 ${className}`}
      style={{ backgroundColor: fx.bracketThemeBackground }}
    >
      <div className="flex-1 min-h-0 p-2 md:p-3 flex flex-col">
        {fx.isLoading && (
          <p className="text-slate-400 text-center py-8 text-sm">演出素材・表を読み込み中…</p>
        )}

        {fx.bracketError && (
          <p className="text-red-300 text-center py-4 text-sm">{fx.bracketError}</p>
        )}

        {!fx.isLoading && !fx.bracketError && fx.hasBracket && fx.displaySnapshot && fx.snapshot && (
          <EffectOrchestrator
            displaySnapshot={fx.displaySnapshot}
            layoutSnapshot={fx.snapshot}
            faceUrlByTeamId={fx.faceUrlByTeamId}
            labelByTeamId={fx.labelByTeamId}
            memberNamesByTeamId={fx.memberNamesByTeamId}
            currentMatchId={fx.currentMatchId}
            matchConfirmed={fx.matchConfirmed}
            skipSignal={fx.skipSignal}
            onMatchConfirmedConsumed={fx.onMatchConfirmedConsumed}
            onEffectComplete={fx.handleEffectComplete}
          />
        )}
      </div>
    </div>
  );
}
