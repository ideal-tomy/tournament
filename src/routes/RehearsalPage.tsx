import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  runRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from '../features/rehearsal/runRehearsal';

export default function RehearsalPage() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RehearsalProgress[]>([]);
  const [result, setResult] = useState<RehearsalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback((entry: RehearsalProgress) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  async function handleStart() {
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      const res = await runRehearsal(appendLog);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リハーサルに失敗しました');
    } finally {
      setRunning(false);
    }
  }

  const displayUrl = result
    ? `/display?eventId=${result.eventId}&kiosk=1`
    : null;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">リハーサルモード</h1>
        <p className="text-slate-400 mt-2 text-sm">
          本番イベントとは別の [REHEARSAL] イベントを作成し、8 名登録 → 抽選 → 3 試合確定まで自動実行します。
        </p>

        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={running}
          className="mt-6 w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-4 text-lg font-bold"
        >
          {running ? '実行中…' : 'リハーサル開始'}
        </button>

        {error && (
          <div className="mt-4 rounded border border-red-500/50 bg-red-950/50 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {logs.length > 0 && (
          <ol className="mt-6 space-y-2 text-sm font-mono">
            {logs.map((log, i) => (
              <li key={`${log.step}-${i}`} className="text-slate-300">
                <span className="text-cyan-400">{log.step}</span>
                {log.detail && (
                  <span className="text-slate-500 ml-2">— {log.detail}</span>
                )}
              </li>
            ))}
          </ol>
        )}

        {result && (
          <div className="mt-8 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-5 space-y-3">
            <p className="text-emerald-300 font-medium">リハーサル完了</p>
            <p className="text-sm text-slate-300">
              {result.eventName}
              <span className="text-slate-500 ml-2">({result.matchesPlayed} 試合)</span>
            </p>
            <p className="text-xs text-slate-500 font-mono break-all">{result.eventId}</p>
            <div className="flex flex-col gap-2 pt-2">
              {displayUrl && (
                <Link
                  to={displayUrl}
                  target="_blank"
                  className="text-center rounded bg-fuchsia-700 hover:bg-fuchsia-600 py-3 font-bold"
                >
                  Display を開く（キオスク URL）
                </Link>
              )}
              <Link
                to={`/admin?eventId=${result.eventId}`}
                className="text-center rounded border border-slate-600 py-3 text-slate-300 hover:bg-slate-800"
              >
                運営画面（このイベント）
              </Link>
            </div>
            <p className="text-xs text-slate-500 pt-2">
              Display を先に開いてからリハーサルを再実行すると、試合確定の演出を確認できます。
            </p>
          </div>
        )}

        <Link to="/admin" className="inline-block mt-8 text-cyan-400 underline text-sm">
          運営画面へ
        </Link>
      </div>
    </div>
  );
}
