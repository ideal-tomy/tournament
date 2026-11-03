import { useState } from 'react';
import { api, ApiError, currentRunId, scopedUrl } from './api';

type Format = 'single_elimination' | 'double_elimination';
const formats: [Format, string][] = [['single_elimination', 'トーナメント'], ['double_elimination', 'ダブルイリミネーション']];
const screens = [
  { path: '/checkin', label: '受付', device: 'スマホ', qr: true },
  { path: '/admin', label: '運営', device: 'スマホ', qr: true },
  { path: '/display', label: '会場モニター', device: 'PC', qr: false },
] as const;

/** Day-of entry: one tournament and the three screens that share it. Presentation checks live under /rehearsal. */
export default function StartPage({ onAuthRequired }: { onAuthRequired(): void }) {
  const [run, setRun] = useState(currentRunId());
  const [format, setFormat] = useState<Format>('single_elimination');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  async function create() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const created = await api<{ eventId: string }>('/api/rehearsal/create', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), format, timingPreset: 'show' }) });
      const url = new URL(location.href); url.searchParams.set('run', created.eventId); history.replaceState(null, '', url);
      setRun(created.eventId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '大会を作れませんでした。');
      if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
    } finally { setBusy(false); }
  }
  async function copy(label: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); } catch { setCopied(''); }
  }
  if (!run) return <section className="card start-card">
    <p className="eyebrow">本番リハーサル</p>
    <h1>大会を作る</h1>
    <div className="segmented" role="radiogroup" aria-label="大会の形式">
      {formats.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={format === value} className={format === value ? 'is-on' : undefined} onClick={() => setFormat(value)}>{label}</button>)}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary submit" disabled={busy} onClick={() => void create()}>{busy ? '作成中…' : '大会を作る'}</button>
  </section>;
  return <section className="card start-card">
    <p className="eyebrow">本番リハーサル · 大会ID …{run.slice(-8)}</p>
    <h1>3つの画面を開く</h1>
    <div className="start-screens">
      {screens.map(screen => {
        const path = scopedUrl(screen.path);
        const full = location.origin + path;
        return <article key={screen.path} className="start-screen">
          <div>
            <h2>{screen.label}</h2>
            <p>{screen.device}</p>
          </div>
          {screen.qr && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(full)}`} alt={`${screen.label}のQR`} width={144} height={144} />}
          <div className="start-screen-actions">
            <a className="button primary" href={path} target={screen.path === '/display' ? '_blank' : undefined} rel="noreferrer">開く</a>
            <button type="button" onClick={() => void copy(screen.path, full)}>{copied === screen.path ? 'コピーしました' : 'URLをコピー'}</button>
          </div>
        </article>;
      })}
    </div>
    <button type="button" className="start-new" onClick={() => { history.replaceState(null, '', '/start'); setRun(null); }}>別の大会を作る</button>
  </section>;
}
