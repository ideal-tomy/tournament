import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CloudflareReadError, fetchCloudflareState } from '../lib/api/cloudflareClient';
import { CLOUDFLARE_CHECK_EVENT_ID, type CloudflareReadModel } from '../lib/api/cloudflareTypes';

export default function CloudflareCheckPage() {
  const [params] = useSearchParams();
  const eventId = params.get('eventId') ?? CLOUDFLARE_CHECK_EVENT_ID;
  const [data, setData] = useState<CloudflareReadModel | null>(null);
  const [error, setError] = useState<CloudflareReadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(null); setData(null); setCheckedAt(null);
    try {
      const state = await fetchCloudflareState(eventId, controller.signal);
      if (!controller.signal.aborted) { setData(state); setCheckedAt(new Date().toLocaleString('ja-JP')); }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof CloudflareReadError ? e : new CloudflareReadError('UNKNOWN', '状態を取得できませんでした。再取得してください。'));
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [eventId]);
  useEffect(() => { void load(); return () => pending.current?.abort(); }, [load]);
  const s = data?.state;
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="flex flex-wrap gap-5 text-cyan-300"><Link to="/">ホーム</Link><Link to="/show-preview">演出プレビュー</Link><Link to="/local-rehearsal">ローカルリハーサル</Link></nav>
      <header><p className="mb-2 text-sm font-bold text-cyan-300">開発専用 · 読取のみ</p><h1 className="text-3xl font-black">Cloudflare接続確認</h1><p className="mt-3 text-slate-300">公開Worker経由でD1の大会状態を取得します。DB・写真の更新は行いません。</p></header>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div><p className="text-sm text-slate-400">確認対象</p><p className="break-all font-mono">{eventId}</p></div>
        <button type="button" className="rounded-lg bg-cyan-700 px-6 py-3 font-bold hover:bg-cyan-600 disabled:opacity-40" disabled={loading} onClick={() => void load()}>{loading ? '取得中…' : '再取得'}</button>
      </section>
      {loading && <p role="status" className="rounded-lg bg-slate-900 p-5">Cloudflareから大会状態を取得しています…</p>}
      {error && <section role="alert" className="space-y-3 rounded-xl border border-red-700 bg-red-950/50 p-5"><h2 className="text-xl font-bold">接続を確認できませんでした{error.status ? `（HTTP ${error.status}）` : ''}</h2><p>{error.message}</p><p className="font-mono text-sm text-red-300">{error.code}</p><p className="text-sm text-slate-300">接続設定は開発サーバー側で行います。この画面にキーを入力する必要はありません。</p></section>}
      {data && s && <section aria-label="取得した大会状態" className="rounded-xl border border-emerald-700 bg-slate-900 p-5 md:p-7">
        <p role="status" className="mb-3 font-bold text-emerald-300">取得成功 · Cloudflare Worker → D1</p>
        <h2 className="mb-5 text-2xl font-black">{data.event.title}</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Object.entries({ 大会ID: data.event.id, environment: data.event.environment, role: data.role, scene: s.scene,
            version: s.version, scene_seq: s.scene_seq, scene_started_at: s.scene_started_at ?? '未開始（null）',
            current_match_id: s.current_match_id ?? 'なし（null）', awaiting_operator: String(s.awaiting_operator),
            presentation_mode: s.presentation_mode, audio_enabled: String(s.audio_enabled), playback: s.playback,
            playback_position_ms: s.playback_position_ms, updated_at: s.updated_at,
          }).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-slate-800 p-3"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 break-all font-mono text-lg">{value}</dd></div>)}
        </dl>
        <h3 className="mb-2 mt-5 font-bold">scene_payload</h3><pre className="overflow-auto rounded-lg bg-slate-800 p-4 text-sm">{JSON.stringify(s.scene_payload, null, 2)}</pre>
        <p className="mt-4 text-sm text-slate-400">取得時刻: {checkedAt} · 自動更新なし（再取得ボタンで確認）</p>
      </section>}
      <p className="text-sm leading-relaxed text-slate-400">localhostの開発サーバー専用です。本番用の認証画面ではありません。既存Admin／DisplayおよびSupabase版の動作は切り替えません。</p>
    </div>
  </main>;
}
