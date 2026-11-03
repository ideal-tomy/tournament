import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Participant } from './api';
import { buildPlaceholderPortrait } from './placeholderPortrait';

interface Submission { requestId: string; name: string; rating: number | null; photo?: string; expectedVersion?: number }
type Facing = 'user' | 'environment';
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
  const [facing, setFacing] = useState<Facing>('user');
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
  async function cameraStream(nextFacing: Facing) {
    const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const open = (videoConstraints: MediaTrackConstraints) => navigator.mediaDevices.getUserMedia({ video: { ...size, ...videoConstraints }, audio: false });
    const next = await open({ facingMode: { ideal: nextFacing } });
    const actual = next.getVideoTracks()[0]?.getSettings().facingMode;
    if (nextFacing === 'user' || actual !== 'user') return next;
    next.getTracks().forEach(track => track.stop());
    const rear = (await navigator.mediaDevices.enumerateDevices()).find(device => device.kind === 'videoinput' && /back|rear|environment|背面/i.test(device.label));
    if (!rear) throw new Error('外側カメラが見つかりませんでした。内側カメラで撮影してください。');
    return open({ deviceId: { exact: rear.deviceId } });
  }
  async function openCamera(nextFacing: Facing = facing) {
    setError(''); setCameraBusy(true); setCameraReady(false);
    const current = ++generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const next = await cameraStream(nextFacing);
      if (!mounted.current || generation.current !== current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = next;
      setFacing(nextFacing);
      setCameraOn(true);
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
    } catch (reason) {
      if (mounted.current && generation.current === current) {
        setError(reason instanceof Error && reason.message.startsWith('外側') ? reason.message : nextFacing === 'environment' ? '外側カメラを開始できませんでした。内側カメラのまま撮影するか、下の撮影ボタンを使ってください。' : 'カメラを開始できませんでした。カメラの許可を確認するか、下の撮影ボタンを使ってください。');
        if (!stream.current) setCameraOn(false);
      }
    } finally { if (mounted.current && generation.current === current) setCameraBusy(false); }
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
  const fileButton = (label: string, capture?: 'user' | 'environment') => <label className={`button file-button${cameraBusy ? ' is-disabled' : ''}`}>{label}<input type="file" accept="image/*" capture={capture} disabled={cameraBusy} onChange={e => { void choosePhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>;
  return <section className="card checkin-form"><h1>{participant ? '参加者を編集' : '参加者を登録'}</h1>
    <form onSubmit={submit}>
      <label className="field">名前<input autoComplete="name" required maxLength={80} value={name} disabled={busy || !!pending} onChange={e => setName(e.target.value)} placeholder="山田 太郎" /></label>
      <label className="field">rating <small>任意</small><input type="number" inputMode="decimal" min=".1" max="30" step=".1" value={rating} disabled={busy || !!pending} onChange={e => setRating(e.target.value)} /></label>
      <fieldset className="photo-fieldset" disabled={busy || !!pending}><legend>写真 <small>任意</small></legend>
        <div className="photo-frame">
          <video ref={video} className={facing === 'user' ? 'selfie' : undefined} hidden={!cameraOn} autoPlay playsInline muted onLoadedData={() => setCameraReady(true)} aria-label={facing === 'user' ? '内側カメラの映像' : '外側カメラの映像'} />
          {(photo || participant?.portraitUrl) && !cameraOn && <img className="photo-preview" src={photo || `${participant?.portraitUrl}?version=${participant?.version}`} alt="登録する写真" />}
          {!photo && !participant && !cameraOn && <div className="photo-placeholder">写真なしでも登録できます</div>}
        </div>
        {cameraOn
          ? <div className="photo-buttons"><button type="button" className="primary" disabled={!cameraReady || cameraBusy} onClick={capture}>撮影</button><button type="button" disabled={cameraBusy || !cameraReady} onClick={() => void openCamera(facing === 'user' ? 'environment' : 'user')}>{facing === 'user' ? '外側に切替' : '内側に切替'}</button><button type="button" onClick={stopCamera}>閉じる</button></div>
          : <div className="photo-buttons">{fileButton('外側で撮る', 'environment')}{fileButton('内側で撮る', 'user')}{fileButton('写真を選ぶ')}<button type="button" onClick={() => void openCamera()} disabled={cameraBusy}>{cameraBusy ? '準備中…' : '画面で撮る'}</button></div>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      {pending && !busy && <p className="hint">送信内容を保持しています。もう一度押すと、同じ登録を再送します（重複しません）。</p>}
      <button className="primary submit" type="submit" disabled={busy || cameraBusy || !name.trim()}>{busy ? '登録しています…' : pending ? '同じ登録を再試行' : participant ? '変更を保存' : '登録する'}</button>
      {participant && <button type="button" disabled={busy || !!pending} onClick={onCancel}>編集をキャンセル</button>}
    </form>
  </section>;
}
