import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BracketView from '../features/bracket/BracketView';
import { isFullSnapshot, toStageData } from '../features/bracket/manager';
import { getNextMatch } from '../features/progression/progression';
import PostMatchStage, { type StageControls } from '../features/presentation/postMatch/PostMatchStage';
import { postMatchTiming } from '../features/presentation/postMatch/timing';
import { confirmLocalResult, currentLocalTeams, drawLocalTournament, emptyLocalTournament, LOCAL_REHEARSAL_KEY, samplePlayers, undoLocalResult, type LocalTeam, type LocalTournament } from '../features/rehearsal/localTournament';
import type { PresentationMode } from '../types';

function restore(): LocalTournament {
  try {
    const raw = localStorage.getItem(LOCAL_REHEARSAL_KEY);
    if (!raw) return emptyLocalTournament();
    const s = JSON.parse(raw) as LocalTournament;
    if (s.schema !== 1 || !Array.isArray(s.players) || !Array.isArray(s.teams) || (s.snapshot && !isFullSnapshot(s.snapshot))) return emptyLocalTournament();
    return s;
  } catch { return emptyLocalTournament(); }
}
const button = 'rounded-lg bg-cyan-700 px-4 py-3 font-bold disabled:opacity-40 hover:bg-cyan-600';
export default function LocalRehearsalPage() {
  const [state, setState] = useState(restore);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [mode, setMode] = useState<PresentationMode>('full');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const stage = useRef<StageControls>(null);
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState('');
  const [name, setName] = useState('');
  const [rating, setRating] = useState('5');
  const [readyAt, setReadyAt] = useState(() => Date.now() + 5000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => () => { camera.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => { if (state.phase !== 'entry') { camera.current?.getTracks().forEach(track => track.stop()); setCameraOn(false); } }, [state.phase]);
  useEffect(() => { if (cameraOn && video.current) { video.current.srcObject = camera.current; void video.current.play().catch(() => setError('カメラ再生を許可してください')); } }, [cameraOn]);
  const progress = useCallback((position: number, active: boolean) => { setTime(position); setPlaying(active); }, []);
  async function update(work: () => Promise<LocalTournament> | LocalTournament) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const next = await work();
      localStorage.setItem(LOCAL_REHEARSAL_KEY, JSON.stringify(next));
      setState(next); setReplay(n => n + 1); setTime(0); setPlaying(false); setReadyAt(Date.now() + 5000);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : '端末内に保存できません。容量・ブラウザ設定を確認してください'); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function openCamera() {
    try {
      camera.current?.getTracks().forEach(track => track.stop());
      camera.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setCameraOn(true); setError('');
    } catch { setError('カメラを開始できません。localhostで開き、カメラ権限と接続を確認してください'); }
  }
  function capture() {
    const v = video.current;
    if (!v?.videoWidth) { setError('映像の準備ができるまで待ってください'); return; }
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
    const size = Math.min(v.videoWidth, v.videoHeight);
    canvas.getContext('2d')?.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 240, 240);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));
    camera.current?.getTracks().forEach(track => track.stop()); setCameraOn(false);
  }
  const current = currentLocalTeams(state);
  const winner = state.teams.find(t => t.id === state.winner);
  const champion = state.teams.find(t => t.id === state.champion);
  const nextContainsWinner = winner && current.some(t => t.id === winner.id);
  const opponent = nextContainsWinner ? current.find(t => t.id !== winner.id) : undefined;
  const teamData = (team: LocalTeam) => ({ name: team.members.map(p => p.name).join(' ＆ '), members: team.members.map(p => p.name), faces: team.members.map(p => p.face) });
  const labels = Object.fromEntries(state.teams.map(t => [t.id, teamData(t).name]));
  const faces = Object.fromEntries(state.teams.map(t => [t.id, t.members.map(p => p.face)]));
  const names = Object.fromEntries(state.teams.map(t => [t.id, t.members.map(p => p.name)]));
  const data = state.snapshot ? toStageData(state.snapshot) : null;
  return <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <nav className="flex flex-wrap gap-5 text-cyan-300"><Link to="/">ホーム</Link><Link to="/show-preview">連続演出だけを調整</Link><Link to="/presentation">操作説明</Link></nav>
      <header><h1 className="text-3xl font-black">ローカル・リハーサル</h1><p className="mt-2 text-amber-200">このブラウザだけに保存 · Cloudflare／本番DBには送信しません。音声と複数端末同期は未接続です。</p></header>
      {error && <p role="alert" className="rounded bg-red-950 p-4 text-red-200">{error}</p>}
      <section className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 p-4">
        <span>サンプル大会:</span>{([8, 16, 32] as const).map(count => <button key={count} className={button} disabled={busy} onClick={() => { if (state.players.length && !window.confirm('この端末内のリハーサルをサンプル大会に置き換えますか？')) return; void update(() => ({ ...emptyLocalTournament(), players: samplePlayers(count) })); }}>{count}名で準備</button>)}
        <button className="rounded border border-slate-500 px-4 py-3" disabled={busy} onClick={() => { if (window.confirm('この端末内の写真とリハーサルを消去しますか？')) void update(emptyLocalTournament); }}>端末内データ消去</button>
        <label>演出モード <select className="rounded bg-slate-700 p-2" value={mode} onChange={e => { setMode(e.target.value as PresentationMode); setTime(0); setPlaying(false); }}><option>full</option><option>short</option><option>lite</option></select></label>
      </section>
      {state.phase === 'entry' && <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-bold">実写で試す（中央クロップ）</h2>
          <p className="text-sm text-slate-300">写真はこのブラウザに残ります。検証後に上の消去ボタンで削除できます。</p>
          {cameraOn && <video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded bg-black" />}
          {photo && <img src={photo} alt="撮影プレビュー" className="h-36 w-36 rounded object-cover" />}
          <div className="flex gap-3"><button className={button} onClick={() => void openCamera()} disabled={busy || cameraOn}>カメラ起動／撮り直し</button>{cameraOn && <button className={button} onClick={capture}>撮影</button>}</div>
          <label className="block">名前<input className="ml-2 rounded bg-slate-700 p-2" value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="block">rating<input className="ml-2 w-24 rounded bg-slate-700 p-2" type="number" min="0.1" step="0.1" value={rating} onChange={e => setRating(e.target.value)} /></label>
          <button className={button} disabled={busy || !photo || !name.trim() || !Number.isFinite(Number(rating)) || Number(rating) <= 0} onClick={() => void update(() => ({ ...state, players: [...state.players, { id: crypto.randomUUID(), name: name.trim(), rating: Number(rating), face: photo }] })).then(ok => { if (ok) { setPhoto(''); setName(''); } })}>この端末に登録</button>
        </div>
        <div className="rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-bold">参加者 {state.players.length}名</h2><div className="my-4 grid max-h-80 grid-cols-4 gap-3 overflow-auto">{state.players.map(p => <div key={p.id}><img src={p.face} alt={p.name} className="aspect-square w-full rounded object-cover" /><p>{p.name}</p></div>)}</div><button className={button} disabled={busy || state.players.length < 4} onClick={() => void update(() => drawLocalTournament(state))}>チーム抽選・トーナメント生成</button></div>
      </section>}
      {state.phase === 'draw' && <section className="rounded-xl bg-slate-900 p-5"><h2 className="text-xl font-bold">抽選結果 · {state.teams.length}チーム</h2><p className="text-slate-300">組み合わせ一覧の確認です。本番のダーツ抽選演出は連携待ちです。</p><div className="my-5 grid gap-4 md:grid-cols-4">{state.teams.map(t => <TeamCard key={t.id} team={t} />)}</div><button className={button} disabled={busy} onClick={() => void update(() => ({ ...state, phase: 'next' }))}>対戦紹介へ</button></section>}
      {state.phase === 'finished' && champion && <section className="rounded-xl border border-amber-400 bg-amber-950/40 p-8 text-center"><h2 className="mb-6 text-5xl font-black text-amber-300">CHAMPION</h2><TeamCard team={champion} /></section>}
      {state.phase === 'result' && winner && <section className="rounded-xl bg-slate-900 p-5"><h2 className="mb-4 text-3xl font-black text-amber-300">WINNER</h2><TeamCard team={winner} />
        {opponent ? <><PostMatchStage key={`${replay}-${mode}`} ref={stage} mode={mode} onProgress={progress} winnerTeam={teamData(winner)} opponentTeam={teamData(opponent)} />
          <div className="my-4 flex flex-wrap gap-3"><button className={button} onClick={() => { stage.current?.seek(0); stage.current?.play(); }}>結果→次試合の演出を再生</button><button className={button} onClick={() => playing ? stage.current?.pause() : stage.current?.play()}>{playing ? '一時停止' : '再開'}</button><button className={button} onClick={() => stage.current?.skip()}>演出スキップ</button></div>
          <label>確認位置 {time.toFixed(1)}秒<input aria-label="演出の確認位置" className="w-full" type="range" min="0" max={postMatchTiming(mode).hold} step="0.01" value={time} onChange={e => stage.current?.seek(Number(e.target.value))} /></label></> : <p className="my-4 text-slate-300">次試合は別チームの対戦です。勝者の対戦相手が決まるまで、勝者と次試合を分けて表示します。</p>}
        <button className={button} disabled={busy} onClick={() => void update(() => ({ ...state, phase: 'next' }))}>NEXT MATCHへ（試合は開始しません）</button>
      </section>}
      {(state.phase === 'next' || state.phase === 'live') && <section className="rounded-xl bg-slate-900 p-6"><h2 className="mb-5 text-3xl font-black text-cyan-300">{state.phase === 'next' ? 'NEXT MATCH' : 'MATCH LIVE'}</h2><div className="grid gap-6 md:grid-cols-2">{current.map((t, slot) => <div key={t.id}><TeamCard team={t} />{state.phase === 'live' && <button className={`${button} mt-4 w-full`} disabled={busy} onClick={() => { if (window.confirm(`${labels[t.id]} の勝利を確定しますか？`)) void update(() => confirmLocalResult(state, slot as 0 | 1)); }}>このチームの勝利を確定</button>}</div>)}</div>
        {state.phase === 'next' && <button className={`${button} mt-5`} disabled={busy || now < readyAt} onClick={() => void update(() => ({ ...state, phase: 'live', undo: null }))}>{now < readyAt ? `対戦カード表示中 · あと${Math.ceil((readyAt - now) / 1000)}秒` : '試合開始 / START MATCH'}</button>}
      </section>}
      {data && <section className="rounded-xl bg-slate-900 p-4"><h2 className="mb-3 text-xl font-bold">トーナメント表</h2><div className="h-[600px] overflow-auto"><BracketView data={data} faceUrlByTeamId={faces} labelByTeamId={labels} memberNamesByTeamId={names} currentMatchId={getNextMatch(data)?.id} /></div>
        <div className="mt-4 flex flex-wrap gap-3"><button className={button} disabled={busy || !state.undo} onClick={() => void update(() => undoLocalResult(state))}>直前の勝敗を戻す</button><button className={button} disabled={busy} onClick={() => { if (window.confirm('写真と参加者を保持して試合を最初からにしますか？')) void update(() => drawLocalTournament(state)); }}>試合だけリセット</button></div>
      </section>}
    </div>
  </main>;
}
function TeamCard({ team }: { team: LocalTeam }) {
  return <div className="rounded-xl border border-slate-600 bg-slate-800 p-4"><div className="flex justify-center gap-3">{team.members.map(p => <div key={p.id} className="min-w-0 flex-1 text-center"><img src={p.face} alt={p.name} className="mx-auto aspect-square w-full max-w-28 rounded-lg object-cover" /><p className="mt-2 break-words font-bold">{p.name}</p></div>)}</div></div>;
}
