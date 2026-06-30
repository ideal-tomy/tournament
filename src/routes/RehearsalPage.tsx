import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  runRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from '../features/rehearsal/runRehearsal';
import { adminUrlForEvent, displayUrlForEvent } from '../lib/displayUrl';

export default function RehearsalPage() {
  const [running, setRunning] = useState(false);
  const [autoMatches, setAutoMatches] = useState(false);
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
      const res = await runRehearsal(appendLog, autoMatches ? 3 : 0);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リハーサルに失敗しました');
    } finally {
      setRunning(false);
    }
  }

  const displayUrl = result ? displayUrlForEvent(result.eventId, { kiosk: true }) : null;
  const adminUrl = result ? adminUrlForEvent(result.eventId) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold">リハーサルモード</h1>
        <p className="text-slate-400 mt-2 text-sm">
          [REHEARSAL] イベントを作成し、<strong className="text-white">32 名（16 チーム）</strong>
          を <code className="text-cyan-300">public/images/test01.png</code> 〜{' '}
          <code className="text-cyan-300">test32.png</code> で登録 → 抽選まで自動実行します。
          演出確認は Display を先に開いてから Admin で試合を進めてください。
        </p>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={autoMatches}
            onChange={(e) => setAutoMatches(e.target.checked)}
            disabled={running}
          />
          自動で 3 試合進める（Display 未接続時・演出確認不可）
        </label>

        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={running}
          className="mt-4 w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-4 text-lg font-bold"
        >
          {running ? '実行中…' : 'リハーサル開始'}
        </button>

        <ol className="mt-6 text-sm text-slate-400 space-y-1 list-decimal list-inside">
          <li>リハーサル開始</li>
          <li>
            <strong className="text-white">Display を開く</strong>（下のボタン）
          </li>
          <li>Admin で試合進行 → Display に表更新 + 演出</li>
        </ol>

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
              <span className="text-slate-500 ml-2">
                ({result.participantCount} 名 · {result.teamCount} チーム
                {result.matchesPlayed > 0 ? ` · ${result.matchesPlayed} 試合自動確定` : ''})
              </span>
            </p>
            <p className="text-xs text-slate-500 font-mono break-all">{result.eventId}</p>
            <div className="flex flex-col gap-2 pt-2">
              {displayUrl && (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center rounded bg-fuchsia-700 hover:bg-fuchsia-600 py-3 font-bold"
                >
                  ① Display を開く（同一 eventId）
                </a>
              )}
              {adminUrl && (
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center rounded bg-slate-700 hover:bg-slate-600 py-3 font-bold"
                >
                  ② Admin を開く（試合進行）
                </a>
              )}
            </div>
            <p className="text-xs text-amber-300/90 pt-2">
              両画面の ID（先頭8文字）が一致していることを確認してから試合を進めてください。
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
