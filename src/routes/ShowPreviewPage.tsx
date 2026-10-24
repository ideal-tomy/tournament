import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PostMatchStage from '../features/presentation/postMatch/PostMatchStage';
import type { StageControls } from '../features/presentation/postMatch/PostMatchStage';
import { postMatchPhase, postMatchTiming } from '../features/presentation/postMatch/timing';
import type { PresentationMode } from '../types';
import { DUMMY_PARTICIPANTS } from '../features/rehearsal/dummyData';

function sampleTeam(indices: number[]) {
  const members = indices.map(index => DUMMY_PARTICIPANTS[index]);
  return { name: members.map(p => p.name).join(' ＆ '), members: members.map(p => p.name), faces: members.map(p => `/images/${p.imageFile}.png`) };
}
const sampleWinner = sampleTeam([0, 7]);
const sampleOpponent = sampleTeam([1, 6]);

export default function ShowPreviewPage() {
  const [mode, setMode] = useState<PresentationMode>(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'lite' : 'full');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showFaces, setShowFaces] = useState(true);
  const stage = useRef<StageControls>(null);
  const progress = useCallback((position: number, active: boolean) => { setTime(position); setPlaying(active); }, []);
  const duration = postMatchTiming(mode).hold;
  const button = 'rounded-lg bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';
  return <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
    <div className="mx-auto max-w-6xl">
      <Link to="/" className="text-cyan-300">← ホーム</Link>
      <h1 className="mt-4 text-2xl font-bold">連続演出プレビュー</h1>
      <p className="mb-6 mt-2 text-amber-200">REHEARSAL · ローカルサンプル専用。本番データへの書き込みはありません。</p>
      <PostMatchStage key={String(showFaces)} ref={stage} mode={mode} onProgress={progress} winnerTeam={showFaces ? sampleWinner : undefined} opponentTeam={showFaces ? sampleOpponent : undefined} />
      <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label="演出操作">
        <label className="mb-4 flex items-center gap-2"><input type="checkbox" checked={showFaces} onChange={e => setShowFaces(e.target.checked)} />同梱の顔写真で確認（切替時は先頭へ戻ります）</label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status">{postMatchPhase(time, mode)} · {playing ? '再生中' : time >= duration ? '手動開始待ち（プレビュー終了）' : '停止中'}</p>
          <label>演出モード <select className="ml-2 rounded bg-slate-700 p-2" value={mode} onChange={e => setMode(e.target.value as PresentationMode)}><option value="full">full</option><option value="short">short</option><option value="lite">lite（光を省略）</option></select></label>
        </div>
        <div className="my-4 flex flex-wrap gap-3">
          <button className={button} onClick={() => { stage.current?.seek(0); stage.current?.play(); }}>最初から再生</button>
          <button className={button} disabled={playing || time >= duration} onClick={() => stage.current?.play()}>再開</button>
          <button className={button} disabled={!playing} onClick={() => stage.current?.pause()}>一時停止</button>
          <button className={button} onClick={() => stage.current?.skip()}>演出スキップ → NEXT MATCH</button>
        </div>
        <label className="block">確認位置 {time.toFixed(1)} / {duration.toFixed(1)}秒
          <input className="mt-2 w-full" type="range" min="0" max={duration} step="0.01" value={time} onChange={e => stage.current?.seek(Number(e.target.value))} />
        </label>
        <p className="mt-3 text-sm text-slate-400">モード変更は停止して先頭へ戻ります。NEXT MATCHは無期限で保持します。音声・本番の試合開始は次の実装段階で接続します。</p>
      </section>
    </div>
  </main>;
}
