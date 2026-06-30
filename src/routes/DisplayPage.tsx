import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EffectOrchestrator from '../features/presentation/EffectOrchestrator';
import { useBracketDisplay } from '../features/bracket/useBracketDisplay';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { displayMediaPreloader } from '../lib/media';
import {
  subscribeWithReconnect,
  type ConnectionStatus,
} from '../lib/realtime';
import { bracketTheme } from '../styles/bracketTheme';
import type { RealtimeEvent } from '../types';

type MatchConfirmed = Extract<RealtimeEvent, { type: 'match:confirmed' }>;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: '接続中…',
  connected: '接続済み',
  disconnected: '切断 — 再接続中',
  error: '接続エラー — 再接続中',
};

export default function DisplayPage() {
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === '1';

  const { event, loading, error, reload } = useActiveEvent();
  const {
    snapshot,
    faceUrlByTeamId,
    labelByTeamId,
    currentMatchId,
    eventStatus,
    hasBracket,
    loading: bracketLoading,
    error: bracketError,
    reload: reloadBracket,
  } = useBracketDisplay(event?.id);

  const [matchConfirmed, setMatchConfirmed] = useState<MatchConfirmed | null>(null);
  const [skipSignal, setSkipSignal] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [mediaReady, setMediaReady] = useState(false);
  const effectPlayingRef = useRef(false);
  const pendingBracketReloadRef = useRef(false);

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
    if (pendingBracketReloadRef.current) {
      pendingBracketReloadRef.current = false;
      reloadBracket();
    }
  }, [reloadBracket]);

  const handleReconnect = useCallback(() => {
    reload();
    reloadBracket();
  }, [reload, reloadBracket]);

  useEffect(() => {
    if (!event) return;
    return subscribeWithReconnect(event.id, {
      onEvent: (payload) => {
        if (payload.type === 'bracket:updated') {
          if (effectPlayingRef.current) {
            pendingBracketReloadRef.current = true;
          } else {
            reloadBracket();
          }
        }
        if (payload.type === 'match:confirmed') {
          effectPlayingRef.current = true;
          setMatchConfirmed(payload);
        }
        if (payload.type === 'event:finished') {
          reload();
          reloadBracket();
        }
        if (payload.type === 'effect:skip') {
          setSkipSignal((n) => n + 1);
        }
      },
      onStatus: setConnectionStatus,
      onReconnect: handleReconnect,
    });
  }, [event?.id, reload, reloadBracket, handleReconnect]);

  const isLoading = loading || bracketLoading || !mediaReady;

  return (
    <div
      className={`min-h-screen text-white flex flex-col ${isKiosk ? 'cursor-none select-none' : ''}`}
      style={{ backgroundColor: bracketTheme.background }}
    >
      <header className="px-6 py-3 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-cyan-300">トーナメント表</h1>
          {event && (
            <p className="text-slate-400 text-sm mt-0.5">
              {event.name}
              <span className="ml-2 text-cyan-500/80 text-xs">ダブルイリミ</span>
              {eventStatus === 'finished' && (
                <span className="ml-2 text-fuchsia-400 font-bold">— 終了</span>
              )}
              {eventStatus === 'running' && (
                <span className="ml-2 text-amber-300 font-medium">— 進行中</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span
            className={`text-xs font-mono ${
              connectionStatus === 'connected'
                ? 'text-emerald-400'
                : connectionStatus === 'connecting'
                  ? 'text-amber-300'
                  : 'text-red-400'
            }`}
            title="Realtime 接続状態"
          >
            {STATUS_LABEL[connectionStatus]}
          </span>
          {!isKiosk && (
            <Link to="/admin" className="text-cyan-400 text-sm underline">
              運営画面
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 p-2 md:p-4 min-h-0 flex flex-col">
        {isLoading && (
          <p className="text-slate-400 text-center py-12">
            {!mediaReady ? '素材読み込み中…' : '読み込み中…'}
          </p>
        )}

        {(error || bracketError) && (
          <div className="rounded border border-red-500/50 bg-red-950/50 p-4 mb-6 max-w-lg mx-auto">
            <p className="text-red-300">{error ?? bracketError}</p>
            <button
              type="button"
              onClick={() => {
                reload();
                reloadBracket();
              }}
              className="mt-3 rounded bg-red-800 px-4 py-2 text-sm"
            >
              再試行
            </button>
          </div>
        )}

        {event && !isLoading && !error && !bracketError && (
          <>
            {!hasBracket && (
              <div className="text-center py-24 text-slate-500">
                <p className="text-lg">ブラケット未生成</p>
                <p className="text-sm mt-2">運営画面で抽選・ブラケット生成を実行してください</p>
              </div>
            )}

            {hasBracket && snapshot && (
              <EffectOrchestrator
                snapshot={snapshot}
                faceUrlByTeamId={faceUrlByTeamId}
                labelByTeamId={labelByTeamId}
                currentMatchId={currentMatchId}
                matchConfirmed={matchConfirmed}
                skipSignal={skipSignal}
                onMatchConfirmedConsumed={() => setMatchConfirmed(null)}
                onEffectComplete={handleEffectComplete}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
