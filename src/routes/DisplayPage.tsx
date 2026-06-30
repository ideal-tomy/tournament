import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveEvent } from '../hooks/useActiveEvent';
import { subscribe } from '../lib/realtime';
import type { RealtimeEvent } from '../types';

interface PingLog {
  at: string;
  type: RealtimeEvent['type'];
}

export default function DisplayPage() {
  const { event, loading, error, reload } = useActiveEvent();
  const [count, setCount] = useState(0);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [logs, setLogs] = useState<PingLog[]>([]);

  useEffect(() => {
    if (!event) return;

    return subscribe(event.id, (payload) => {
      const now = new Date().toLocaleTimeString('ja-JP');
      setCount((c) => c + 1);
      setLastAt(now);
      setLogs((prev) => [{ at: now, type: payload.type }, ...prev].slice(0, 20));
    });
  }, [event?.id]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">表示端末 — Phase 0</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Realtime 受信デバッグ
            {' · '}
            <Link to="/admin" className="text-cyan-400 underline">
              運営画面
            </Link>
          </p>
        </header>

        {loading && <p className="text-slate-400">イベント読み込み中…</p>}
        {error && (
          <div className="rounded border border-red-500/50 bg-red-950/50 p-4 mb-6">
            <p className="text-red-300">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded bg-red-800 px-4 py-2 text-sm"
            >
              再試行
            </button>
          </div>
        )}

        {event && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
              <p className="text-slate-400 text-sm">イベント</p>
              <p className="text-xl font-bold mt-1">{event.name}</p>
              <p className="text-xs text-slate-500 font-mono mt-2 break-all">
                {event.id}
              </p>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-8 text-center">
              <p className="text-cyan-300/80 text-sm uppercase tracking-widest">
                Realtime 受信数
              </p>
              <p className="text-7xl font-black text-cyan-400 tabular-nums mt-2">
                {count}
              </p>
              {lastAt && (
                <p className="text-slate-400 mt-4">最終受信: {lastAt}</p>
              )}
            </div>

            {logs.length > 0 && (
              <div className="rounded-xl border border-slate-700 p-4">
                <p className="text-sm text-slate-400 mb-3">受信ログ（最新20件）</p>
                <ul className="space-y-1 text-sm font-mono">
                  {logs.map((log, i) => (
                    <li key={`${log.at}-${i}`} className="text-slate-300">
                      [{log.at}] {log.type}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
