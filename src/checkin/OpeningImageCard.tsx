import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { DrawState } from './DrawControl';
import { openingMedia } from './VenueOpening';

const MAX_SIDE = 1920;

/** Phone photos are shrunk to the venue screen size before upload. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像を読み込めませんでした。');
    context.fillStyle = '#07060a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally { URL.revokeObjectURL(url); }
}

/** The venue standby image of this event. Replaceable until the pair announcement starts. */
export default function OpeningImageCard({ onAuthRequired }: { onAuthRequired(): void }) {
  const [state, setState] = useState<Pick<DrawState, 'eventId' | 'scene' | 'openingVersion' | 'title'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try { setState(await api<DrawState>('/api/draw/state')); }
    catch (reason) { if (reason instanceof ApiError && reason.status === 401) onAuthRequired(); }
  }, [onAuthRequired]);
  useEffect(() => { void load(); }, [load]);
  async function upload(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const image = await shrink(file);
      const saved = await api<{ openingVersion: string }>(`/api/events/${state!.eventId}/opening`, { method: 'POST', body: JSON.stringify({ image }) });
      setState(previous => previous && { ...previous, openingVersion: saved.openingVersion });
      setMessage('会場モニターの待機画像を変更しました。');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      setError(reason instanceof Error ? reason.message : '画像を保存できませんでした。');
      if (reason instanceof ApiError && reason.code === 'OPENING_LOCKED') void load();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  if (!state) return null;
  const media = openingMedia(state.eventId, state.openingVersion, state.title);
  const editable = state.scene === 'idle';
  return <section className="card opening-card">
    <div className="opening-card-head">
      <h2>待機画像</h2>
      <span>{state.openingVersion ? 'この大会の画像' : '共通の画像'}</span>
    </div>
    {media.kind === 'image' && <img className="opening-card-preview" src={media.src} alt={media.alt} />}
    {editable
      ? <label className={`button opening-card-pick${busy ? ' is-busy' : ''}`}>
        {busy ? '保存中…' : '待機画像を設定'}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={event => void upload(event.target.files?.[0])} />
      </label>
      : <p className="opening-card-note">ペア発表が始まったので、待機画像は変更できません。</p>}
    {message && <p role="status" className="ok">{message}</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
