import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { EVENT_FORMATS, formatLabel, type EventFormat } from './eventFormat';

const screens = [
  { path: '/checkin', label: '受付', device: 'スマホ', qr: true },
  { path: '/admin', label: '運営', device: 'スマホ', qr: true },
  { path: '/display', label: '会場モニター', device: 'PC', qr: false },
] as const;

interface SavedEvent { id: string; label: string; format: string; count: number; fixed: boolean }

function EventScreens({ event, copied, onCopy }: { event: SavedEvent; copied: string; onCopy(key: string, text: string): void }) {
  return <div className="start-screens">
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
          <button type="button" onClick={() => onCopy(key, full)}>{copied === key ? 'コピーしました' : 'URLをコピー'}</button>
        </div>
      </article>;
    })}
  </div>;
}

function summary(event: SavedEvent) {
  return [formatLabel(event.format), `${event.count}名`, `大会ID …${event.id.slice(-8)}`].filter(Boolean).join(' · ');
}

/** Day-of entry: the fixed main tournament first, then tournaments created here. Each runs on its own ?run=. */
export default function StartPage({ onAuthRequired }: { onAuthRequired(): void }) {
  const [events, setEvents] = useState<SavedEvent[] | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [opened, setOpened] = useState('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<EventFormat>('single_elimination');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const pending = useRef<{ requestId: string; title: string; format: EventFormat } | null>(null);
  const load = useCallback(async () => {
    try {
      const value = await api<{ officialEventId: string | null; events?: SavedEvent[] }>('/api/rehearsal/config');
      const list = value.events ?? [];
      setEvents(value.officialEventId && !list.some(event => event.id === value.officialEventId) ? [{ id: value.officialEventId, label: '大会00000001', format: '', count: 0, fixed: true }, ...list] : list);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      else if (reason instanceof ApiError && reason.status === 404) setEvents(null);
      else setError(reason instanceof Error ? reason.message : '接続できませんでした。');
    }
  }, [onAuthRequired]);
  useEffect(() => { void load(); }, [load]);
  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); } catch { setCopied(''); }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating || !title.trim()) return;
    if (pending.current && (pending.current.title !== title.trim() || pending.current.format !== format)) pending.current = null;
    pending.current ??= { requestId: crypto.randomUUID(), title: title.trim(), format };
    setCreating(true); setCreateError('');
    try {
      const created = await api<{ eventId: string }>('/api/rehearsal/create', { method: 'POST', body: JSON.stringify({ ...pending.current, timingPreset: 'show' }) });
      pending.current = null; setTitle('');
      await load();
      setOpened(created.eventId);
      requestAnimationFrame(() => document.getElementById(`event-${created.eventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      if (reason instanceof ApiError && reason.status < 500) pending.current = null;
      setCreateError(reason instanceof Error ? reason.message : '大会を作れませんでした。');
    } finally { setCreating(false); }
  }
  if (error) return <section className="card start-card"><p role="alert" className="error">{error}</p><button onClick={() => location.reload()}>再接続</button></section>;
  if (events === undefined) return <p role="status">大会を確認しています…</p>;
  if (events === null) return <section className="card start-card">
    <p className="eyebrow">大会00000001</p>
    <h1>大会を作れない環境です</h1>
    <p>この公開先では、大会の作成と一覧を使えません。</p>
  </section>;
  const [main, ...others] = events;
  return <>
    {main && <section id={`event-${main.id}`} className="card start-card">
      <p className="eyebrow">{main.label} · {summary(main)}</p>
      <h1>{main.label}の3つの画面を開く</h1>
      <EventScreens event={main} copied={copied} onCopy={(key, text) => void copy(key, text)} />
    </section>}
    <section className="card start-card start-create">
      <h2>新しい大会を作る</h2>
      <p>会場ごとに大会を分けて、同時に運営できます。参加者と進行は大会ごとに保存されます。</p>
      <form onSubmit={event => void create(event)}>
        <label className="field">大会名<input value={title} maxLength={80} required onChange={event => setTitle(event.target.value)} placeholder="例：渋谷会場 11月大会" /></label>
        <div className="segmented" role="radiogroup" aria-label="ゲーム形式">
          {EVENT_FORMATS.map(item => <button key={item.value} type="button" role="radio" aria-checked={format === item.value} className={format === item.value ? 'is-on' : undefined} onClick={() => setFormat(item.value)}>{item.label}<small>{item.note}</small></button>)}
        </div>
        {createError && <p role="alert" className="error">{createError}</p>}
        <button type="submit" className="primary submit" disabled={creating || !title.trim()}>{creating ? '作成中…' : '大会を作る'}</button>
      </form>
    </section>
    {others.length > 0 && <section className="start-list" aria-label="保存済みの大会">
      <h2 className="start-list-title">保存済みの大会</h2>
      {others.map(event => <details key={event.id} id={`event-${event.id}`} className="card start-card start-event" open={event.id === opened}>
        <summary><strong>{event.label}</strong><span>{summary(event)}</span></summary>
        <EventScreens event={event} copied={copied} onCopy={(key, text) => void copy(key, text)} />
      </details>)}
    </section>}
  </>;
}
