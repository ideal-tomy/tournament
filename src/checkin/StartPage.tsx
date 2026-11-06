import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

const screens = [
  { path: '/checkin', label: '受付', device: 'スマホ', qr: true },
  { path: '/admin', label: '運営', device: 'スマホ', qr: true },
  { path: '/display', label: '会場モニター', device: 'PC', qr: false },
] as const;

interface FixedEvent { id: string; label: string }

/** Day-of entry: the pre-registered tournaments and their three screens. Presentation checks live under /rehearsal. */
export default function StartPage({ onAuthRequired }: { onAuthRequired(): void }) {
  const [events, setEvents] = useState<FixedEvent[] | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<{ officialEventId: string | null; events?: FixedEvent[] }>('/api/rehearsal/config').then(value => {
      if (cancelled) return;
      const list = value.events ?? [];
      setEvents(value.officialEventId && !list.some(event => event.id === value.officialEventId) ? [{ id: value.officialEventId, label: '本番' }, ...list] : list);
    }).catch(reason => {
      if (cancelled) return;
      if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      else if (reason instanceof ApiError && reason.status === 404) setEvents(null);
      else setError(reason instanceof Error ? reason.message : '接続できませんでした。');
    });
    return () => { cancelled = true; };
  }, [onAuthRequired]);
  async function copy(label: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); } catch { setCopied(''); }
  }
  if (error) return <section className="card start-card"><p role="alert" className="error">{error}</p><button onClick={() => location.reload()}>再接続</button></section>;
  if (events === undefined) return <p role="status">大会を確認しています…</p>;
  if (!events?.length) return <section className="card start-card">
    <p className="eyebrow">本番</p>
    <h1>公式大会が設定されていません</h1>
    <p>確認用の大会は「演出を確認する」から準備してください。</p>
    <a className="button primary" href="/rehearsal">演出を確認する</a>
  </section>;
  return <>{events.map(event => <section key={event.id} className="card start-card">
    <p className="eyebrow">{event.label} · 大会ID …{event.id.slice(-8)}</p>
    <h1>{event.label}の3つの画面を開く</h1>
    <div className="start-screens">
      {screens.map(screen => {
        const path = `${screen.path}?run=${event.id}`;
        const full = location.origin + path;
        const key = `${event.id}${screen.path}`;
        return <article key={screen.path} className="start-screen">
          <div>
            <h2>{screen.label}</h2>
            <p>{screen.device}</p>
          </div>
          {screen.qr && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(full)}`} alt={`${event.label} ${screen.label}のQR`} width={144} height={144} />}
          <div className="start-screen-actions">
            <a className="button primary" href={path} target={screen.path === '/display' ? '_blank' : undefined} rel="noreferrer">開く</a>
            <button type="button" onClick={() => void copy(key, full)}>{copied === key ? 'コピーしました' : 'URLをコピー'}</button>
          </div>
        </article>;
      })}
    </div>
  </section>)}</>;
}
