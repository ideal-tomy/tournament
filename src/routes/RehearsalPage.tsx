import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLatestRehearsalEvent } from '../lib/event';
import {
  createFreshRehearsal,
  reuseRehearsal,
  type RehearsalProgress,
  type RehearsalResult,
} from '../features/rehearsal/rehearsalActions';
import { adminUrlForEvent, displayUrlForEvent } from '../lib/displayUrl';

export default function RehearsalPage() {
  const [running, setRunning] = useState(false);
  const [autoMatches, setAutoMatches] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [logs, setLogs] = useState<RehearsalProgress[]>([]);
  const [result, setResult] = useState<RehearsalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getLatestRehearsalEvent().then((ev) => setHasExisting(ev != null));
  }, [result]);

  const appendLog = useCallback((entry: RehearsalProgress) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  async function handleStart(reuse: boolean) {
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);

    try {
      const matchCount = autoMatches ? 3 : 0;
      const res = reuse
        ? await reuseRehearsal(appendLog, matchCount)
        : await createFreshRehearsal(appendLog, matchCount);
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
        <Link to="/" className="text-slate-400 text-sm underline">
          ← トップ
        </Link>
        <h1 className="text-2xl font-bold mt-4">リハーサルモード</h1>
        <p className="text-slate-400 mt-2 text-sm">
          [REHEARSAL] イベントで <strong className="text-white">32 名（16 チーム）</strong>
          のサンプルを使い、演出・表示を確認します。
          <strong className="text-emerald-300"> 終了しても参加者・写真は削除されません。</strong>
        </p>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={autoMatches}
            onChange={(e) => setAutoMatches(e.target.checked)}
            disabled={running}
          />
          自動で 3 試合進める（Display 未接続時のみ）
        </label>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleStart(true)}
            disabled={running}
            className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 py-4 text-lg font-bold"
          >
            {running ? '実行中…' : 'サンプル再利用 — 試合を最初から'}
          </button>
          <p className="text-xs text-slate-500 text-center">
            {hasExisting
              ? '最新リハーサルの 32 名・写真を維持し、ブラケットだけ再生成'
              : '初回は下の「新規作成」を実行してください'}
          </p>

          <button
            type="button"
            onClick={() => void handleStart(false)}
            disabled={running}
            className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 py-3 font-bold text-sm"
          >
            新規リハーサル作成（32 名を再登録）
          </button>
        </div>

        <ol className="mt-6 text-sm text-slate-400 space-y-1 list-decimal list-inside">
          <li>上のボタンで準備（再利用がおすすめ）</li>
          <li>
            <strong className="text-white">Display を開く</strong>
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
            <p className="text-emerald-300 font-medium">
              {result.reused ? 'リハーサル再利用完了' : 'リハーサル新規作成完了'}
            </p>
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
          </div>
        )}
      </div>
    </div>
  );
}
