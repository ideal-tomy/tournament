import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EventIdBadge from '../components/EventIdBadge';
import { ensureDemoReady } from '../features/demo/ensureDemoReady';
import MatchControl from '../features/progression/MatchControl';
import {
  reuseRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from '../features/rehearsal/rehearsalActions';
import { displayUrlForEvent } from '../lib/displayUrl';
import { syncEventIdToUrl } from '../lib/event';

type Phase = 'loading' | 'ready' | 'error';

export default function DemoPage() {
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('eventId');

  const [phase, setPhase] = useState<Phase>('loading');
  const [logs, setLogs] = useState<RehearsalProgress[]>([]);
  const [result, setResult] = useState<RehearsalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [matchKey, setMatchKey] = useState(0);

  const appendLog = useCallback((entry: RehearsalProgress) => {
    setLogs((prev) => [...prev, entry]);
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

  async function handleReset() {
    if (!result) return;
    setResetting(true);
    setError(null);
    setLogs([]);
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

  const displayUrl = result ? displayUrlForEvent(result.eventId, { kiosk: true }) : null;
  const shareUrl =
    result != null
      ? `${window.location.origin}/demo?eventId=${encodeURIComponent(result.eventId)}`
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-lg mx-auto px-5 py-8">
        <Link to="/" className="text-slate-500 text-sm underline">
          ← トップ
        </Link>

        <header className="mt-4">
          <p className="text-xs font-black tracking-widest text-cyan-400 uppercase">Demo</p>
          <h1 className="text-2xl font-black mt-1">試合進行 × 演出体験</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            ログイン不要 · サンプル 32 名（16 チーム）で、本番と同じ勝敗確定 → Display 演出を体験できます。
          </p>
        </header>

        {phase === 'loading' && (
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-cyan-300 font-medium animate-pulse">サンプルを準備中…</p>
            {logs.length > 0 && (
              <ol className="mt-4 space-y-1.5 text-sm font-mono text-slate-400">
                {logs.map((log, i) => (
                  <li key={`${log.step}-${i}`}>
                    <span className="text-slate-300">{log.step}</span>
                    {log.detail && <span className="text-slate-600 ml-2">— {log.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-8 rounded-xl border border-red-500/40 bg-red-950/40 p-5">
            <p className="text-red-300 font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void prepare()}
              className="mt-4 w-full rounded-lg bg-red-800 hover:bg-red-700 py-3 font-bold"
            >
              再試行
            </button>
          </div>
        )}

        {phase === 'ready' && result && (
          <div className="mt-8 space-y-6">
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4 text-sm">
              <p className="text-emerald-300 font-bold">準備完了</p>
              <p className="text-slate-300 mt-1">{result.eventName}</p>
              <p className="text-slate-500 mt-1">
                {result.participantCount} 名 · {result.teamCount} チーム
              </p>
              <div className="mt-2">
                <EventIdBadge eventId={result.eventId} className="text-slate-500" />
              </div>
            </div>

            <section className="rounded-xl border border-fuchsia-800/50 bg-fuchsia-950/20 p-5 space-y-3">
              <h2 className="text-sm font-black text-fuchsia-300">① Display を開く</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                別タブ（または別画面）で Display を開いてください。ここで勝敗を確定すると、Display
                にトーナメント表の更新と演出がリアルタイムで反映されます。
              </p>
              {displayUrl && (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center rounded-xl bg-fuchsia-700 hover:bg-fuchsia-600 py-4 text-lg font-black shadow-lg shadow-fuchsia-900/40"
                >
                  Display を開く
                </a>
              )}
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-sm font-black text-white mb-4">② 勝者を選んで確定</h2>
              <MatchControl
                key={`${result.eventId}-${matchKey}`}
                eventId={result.eventId}
              />
            </section>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting}
                className="w-full rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 py-3 text-sm font-medium disabled:opacity-40"
              >
                {resetting ? 'リセット中…' : '試合を最初から（サンプル維持）'}
              </button>
            </div>

            {shareUrl && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-500 mb-2">この URL を共有（同じサンプルイベント）</p>
                <p className="text-xs font-mono text-slate-400 break-all select-all">{shareUrl}</p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 rounded-lg p-3">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
