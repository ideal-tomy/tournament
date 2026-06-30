import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BracketView from '../features/bracket/BracketView';
import { useBracketDisplay } from '../features/bracket/useBracketDisplay';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { subscribe } from '../lib/realtime';
import { bracketTheme } from '../styles/bracketTheme';

export default function DisplayPage() {
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

  useEffect(() => {
    if (!event) return;
    return subscribe(event.id, (payload) => {
      if (payload.type === 'bracket:updated') {
        reloadBracket();
      }
      if (payload.type === 'match:confirmed') {
        console.info('[Display] match:confirmed', payload);
      }
      if (payload.type === 'event:finished') {
        console.info('[Display] event:finished', payload);
      }
      if (payload.type === 'effect:skip') {
        console.info('[Display] effect:skip', payload);
      }
    });
  }, [event?.id, reloadBracket]);

  const isLoading = loading || bracketLoading;

  return (
    <div
      className="min-h-screen text-white flex flex-col"
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
        <Link to="/admin" className="text-cyan-400 text-sm underline shrink-0">
          運営画面
        </Link>
      </header>

      <main className="flex-1 p-2 md:p-4 min-h-0 flex flex-col">
        {isLoading && (
          <p className="text-slate-400 text-center py-12">読み込み中…</p>
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
              <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center">
                <BracketView
                  data={snapshot}
                  faceUrlByTeamId={faceUrlByTeamId}
                  labelByTeamId={labelByTeamId}
                  currentMatchId={currentMatchId}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
