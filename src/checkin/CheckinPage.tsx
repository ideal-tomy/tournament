import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Participant } from './api';
import { buildPlaceholderPortrait } from './placeholderPortrait';

interface Submission { requestId: string; name: string; rating: number | null; photo?: string; expectedVersion?: number }
function crop(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 480;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('写真を作成できませんでした。別のブラウザでお試しください。');
  const side = Math.min(width, height);
  context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 480, 480);
  return canvas.toDataURL('image/jpeg', .85);
}
export default function CheckinPage({ onAuthRequired, participant, onSaved, onCancel }: { onAuthRequired(): void; participant?: Participant; onSaved(value: Participant, cleanupPending: number): void; onCancel(): void }) {
  const [name, setName] = useState(participant?.name ?? '');
  const [rating, setRating] = useState(participant?.rating?.toString() ?? '');
  const [photo, setPhoto] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Submission | null>(null);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  function stopCamera() {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setCameraOn(false); setCameraReady(false); setCameraBusy(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  async function openCamera() {
    stopCamera(); setError(''); setCameraBusy(true);
    const current = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!mounted.current || generation.current !== current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      setCameraOn(true);
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
    } catch { if (mounted.current && generation.current === current) { stopCamera(); setError('カメラを開始できませんでした。カメラの許可を確認するか、「スマホのカメラで撮影・写真を選択」を使ってください。'); } }
    finally { if (mounted.current && generation.current === current) setCameraBusy(false); }
  }
  function capture() {
    try {
      if (!video.current?.videoWidth) throw new Error('カメラの準備ができるまでお待ちください。');
      setPhoto(crop(video.current, video.current.videoWidth, video.current.videoHeight)); stopCamera(); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '撮影できませんでした。'); }
  }
  async function choosePhoto(file?: File) {
    if (!file) return;
    stopCamera(); setError('');
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { setError('20MB以下の写真を選択してください。'); return; }
    setCameraBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error();
      if (mounted.current) setPhoto(crop(image, image.naturalWidth, image.naturalHeight));
    } catch { if (mounted.current) setError('この写真を読み取れませんでした。JPEG形式で撮影し直してください。'); }
    finally { URL.revokeObjectURL(url); if (mounted.current) setCameraBusy(false); }
  }
  function photoForRegistration() {
    if (photo) return photo;
    if (participant) return undefined;
    return buildPlaceholderPortrait(name.trim());
  }
  function applyPlaceholder() {
    if (!name.trim()) { setError('名前を入力してから仮画像を使えます。'); return; }
    setPhoto(buildPlaceholderPortrait(name)); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const registrationPhoto = photoForRegistration();
    const submission = pending ?? { requestId: crypto.randomUUID(), name: name.trim(), rating: rating === '' ? null : Number(rating), ...(registrationPhoto ? { photo: registrationPhoto } : {}), ...(participant ? { expectedVersion: participant.version } : {}) };
    submitting.current = true; setBusy(true); setError(''); setPending(submission); stopCamera();
    try {
      const result = await api<{ participant: Participant; cleanupPending: number }>(participant ? `/api/participants/${participant.id}` : '/api/participants', { method: participant ? 'PATCH' : 'POST', body: JSON.stringify(submission) });
      if (mounted.current) { setPending(null); setName(''); setRating(''); setPhoto(''); onSaved(result.participant, result.cleanupPending); }
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : '登録できませんでした。');
      if (reason instanceof ApiError) {
        if (reason.status === 401) onAuthRequired();
        if (reason.status >= 400 && reason.status < 500 && reason.status !== 401) setPending(null);
      }
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="card"><p className="eyebrow">REHEARSAL / CHECK-IN</p><h1>{participant ? '参加者を編集' : '参加者受付'}</h1><p className="intro">名前は必須です。顔写真は任意で、未撮影の場合は登録時に仮の画像を保存します。撮影した写真は中央を正方形に切り取ります。</p>
    <form onSubmit={submit}>
      <label className="field">名前 <span>必須</span><input autoComplete="name" required maxLength={80} value={name} disabled={busy || !!pending} onChange={e => setName(e.target.value)} placeholder="例：山田 太郎" /></label>
      <label className="field">rating <small>任意</small><input type="number" inputMode="decimal" min=".1" max="30" step=".1" value={rating} disabled={busy || !!pending} onChange={e => setRating(e.target.value)} placeholder="未入力でも登録できます" /></label>
      <fieldset disabled={busy || !!pending}><legend>顔写真 <small>任意</small></legend>
        <video ref={video} hidden={!cameraOn} autoPlay playsInline muted onLoadedData={() => setCameraReady(true)} aria-label="カメラ映像" />
        {(photo || participant?.portraitUrl) && !cameraOn && <img className="photo-preview" src={photo || `${participant?.portraitUrl}?version=${participant?.version}`} alt="登録前の写真プレビュー" />}
        {!photo && !participant && !cameraOn && <div className="photo-placeholder">撮影しなくても、名前だけで仮の画像を付けて登録できます。</div>}
        <div className="actions"><button type="button" onClick={() => void openCamera()} disabled={cameraBusy}>{cameraBusy ? '準備中…' : photo ? 'カメラで撮り直す' : 'カメラを起動'}</button>{cameraOn && <><button type="button" className="primary" disabled={!cameraReady} onClick={capture}>写真を撮影</button><button type="button" onClick={stopCamera}>カメラを閉じる</button></>}{!participant && <button type="button" onClick={applyPlaceholder} disabled={cameraBusy || !name.trim()}>仮の画像を確認</button>}</div>
        <label className="file-label">スマホのカメラで撮影・写真を選択<input type="file" accept="image/*" capture="user" disabled={cameraBusy} onChange={e => { void choosePhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      {pending && !busy && <p className="hint">送信した内容を保持しています。「同じ登録を再試行」で確認・保存します。重複登録は行いません。この画面を閉じずに再試行してください。</p>}
      <button className="primary submit" type="submit" disabled={busy || cameraBusy || !name.trim()}>{busy ? '登録しています…' : pending ? '同じ登録を再試行' : participant ? '変更を保存' : photo ? '参加者を登録' : '仮画像で参加者を登録'}</button>
      {participant && <button type="button" disabled={busy || !!pending} onClick={onCancel}>編集をキャンセル</button>}
    </form>
  </section>;
}
