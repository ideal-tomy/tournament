import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DisplayEffectPanel } from '../features/display/useDisplayEffects';
import { ensureDemoReady } from '../features/demo/ensureDemoReady';
import MatchControl from '../features/progression/MatchControl';
import type { MatchConfirmedEvent } from '../features/progression/progressionApi';
import {
  reuseRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from '../features/rehearsal/rehearsalActions';
import { syncEventIdToUrl } from '../lib/event';

type Phase = 'loading' | 'ready' | 'error';

type EffectTriggers = {
  queueMatchConfirmed: (payload: MatchConfirmedEvent) => void;
  triggerEffectSkip: () => void;
};

export default function DemoPage() {
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('eventId');

  const [phase, setPhase] = useState<Phase>('loading');
  const [logs, setLogs] = useState<RehearsalProgress[]>([]);
  const [result, setResult] = useState<RehearsalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [matchKey, setMatchKey] = useState(0);

  const effectTriggersRef = useRef<EffectTriggers | null>(null);

  const appendLog = useCallback((entry: RehearsalProgress) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const registerEffectTriggers = useCallback((triggers: EffectTriggers) => {
    effectTriggersRef.current = triggers;
  }, []);

  const prepare = useCallback(async () => {
    setPhase('loading');
    setLogs([]);
    setError(null);
    try {
      const res = await ensureDemoReady(urlEventId, appendLog);
      syncEventIdToUrl(res.eventId);
      setResult(res);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'デモの準備に失敗しました');
      setPhase('error');
    }
  }, [urlEventId, appendLog]);

  useEffect(() => {
    void prepare();
  }, [prepare]);

  const handleMatchConfirmed = useCallback((payload: MatchConfirmedEvent) => {
    effectTriggersRef.current?.queueMatchConfirmed(payload);
  }, []);

  const handleEffectSkip = useCallback(() => {
    effectTriggersRef.current?.triggerEffectSkip();
  }, []);

  async function handleReset() {
    if (!result) return;
    setResetting(true);
    setError(null);
    try {
      const res = await reuseRehearsal(appendLog, 0);
      syncEventIdToUrl(res.eventId);
      setResult(res);
      setMatchKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リセットに失敗しました');
    } finally {
      setResetting(false);
    }
  }

  const shareUrl =
    result != null
      ? `${window.location.origin}/demo?eventId=${encodeURIComponent(result.eventId)}`
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-slate-500 text-xs underline">
            ← トップ
          </Link>
          <h1 className="text-lg font-black mt-1">試合進行 × 演出デモ</h1>
          <p className="text-slate-500 text-xs mt-0.5">ログイン不要 · サンプル 32 名</p>
        </div>
        {result && (
          <p className="text-xs text-slate-600 font-mono hidden sm:block">
            {result.eventId.slice(0, 8)}…
          </p>
        )}
      </header>

      {phase === 'loading' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-cyan-300 font-medium animate-pulse">サンプルを準備中…</p>
            {logs.length > 0 && (
              <ol className="mt-4 space-y-1 text-sm font-mono text-slate-500">
                {logs.map((log, i) => (
                  <li key={`${log.step}-${i}`}>{log.step}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full rounded-xl border border-red-500/40 bg-red-950/40 p-5">
            <p className="text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void prepare()}
              className="mt-4 w-full rounded-lg bg-red-800 py-3 font-bold"
            >
              再試行
            </button>
          </div>
        </div>
      )}

      {phase === 'ready' && result && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <section className="flex-1 min-h-[42vh] lg:min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
            <p className="shrink-0 px-3 py-1.5 text-xs text-fuchsia-300/90 bg-fuchsia-950/30 border-b border-fuchsia-900/40">
              演出表示 — 下で勝敗を確定するとここに WIN → 接近 → 爆発 → VS が流れます
            </p>
            <DisplayEffectPanel
              key={`display-${result.eventId}-${matchKey}`}
              eventId={result.eventId}
              className="flex-1"
              onRegisterTriggers={registerEffectTriggers}
            />
          </section>

          <section className="lg:w-[22rem] xl:w-[24rem] shrink-0 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
            <div className="text-sm">
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-wide">操作</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                1 試合目は勝利表示のみ。2 試合目以降でフル演出（棒上昇・接近・爆発・VS）が流れます。
              </p>
            </div>

            <MatchControl
              key={`control-${result.eventId}-${matchKey}`}
              eventId={result.eventId}
              onMatchConfirmed={handleMatchConfirmed}
              onEffectSkip={handleEffectSkip}
            />

            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={resetting}
              className="w-full rounded-lg border border-slate-600 text-slate-400 py-2.5 text-sm disabled:opacity-40"
            >
              {resetting ? 'リセット中…' : '試合を最初から'}
            </button>

            {shareUrl && (
              <div className="rounded-lg border border-slate-800 p-3">
                <p className="text-xs text-slate-600 mb-1">共有 URL</p>
                <p className="text-[10px] font-mono text-slate-500 break-all select-all">{shareUrl}</p>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
