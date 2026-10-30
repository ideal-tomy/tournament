import { scopedUrl } from './api';
import { useCallback, useEffect, useRef, useState } from 'react';
import PostMatchStage, { type StageControls } from '../features/presentation/postMatch/PostMatchStage';
import { postMatchTiming } from '../features/presentation/postMatch/timing';
import FixtureStage, { fixtureDuration } from '../preview/FixtureStage';
import type { PresentationMode } from '../types';
import { toPresentationTeam, type PresentationTeam } from './presentationAdapter';
import { useParticipants } from './useParticipants';
import '../preview/preview.css';

const scenes = ['draw', 'result', 'bracket', 'vs', 'next', 'champion'] as const;
type Scene = typeof scenes[number];
const labels: Record<Scene, string> = { draw: 'Draw', result: 'Result', bracket: 'Bracket advance', vs: 'VS', next: 'NEXT MATCH', champion: 'Champion' };
const emptyTeam: PresentationTeam = { name: '', members: [], faces: [], participantIds: [] };
function bounds(scene: Scene, mode: PresentationMode) {
  const t = postMatchTiming(mode);
  if (scene === 'draw' || scene === 'champion') return { start: 0, end: fixtureDuration(scene, mode) };
  if (scene === 'result') return { start: 0, end: t.advance - .01 };
  if (scene === 'bracket') return { start: t.advance, end: t.approach - .01 };
  if (scene === 'vs') return { start: t.approach, end: t.impact + .49 };
  return { start: t.impact + .9, end: t.hold };
}
export default function LiveShowPreviewPage({ onAuthRequired, sessionVersion }: { onAuthRequired(): void; sessionVersion: number }) {
  const { participants, excludedTests, error, loading, revision, refresh } = useParticipants(onAuthRequired, sessionVersion);
  const [photoError, setPhotoError] = useState(false);
  const query = new URLSearchParams(location.search);
  const [selectedId, setSelectedId] = useState(query.get('participant') ?? '');
  const [opponentId, setOpponentId] = useState('');
  const [selectedScene, setScene] = useState<Scene>(scenes.find(scene => scene === query.get('scene')) ?? 'result');
  const [mode, setMode] = useState<PresentationMode>(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'lite' : 'full');
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [finished, setFinished] = useState(false);
  const stage = useRef<StageControls>(null), ended = useRef(false);
  const eligible = participants.filter(participant => participant.portraitSource === 'uploaded');
  const winner = eligible.find(participant => participant.id === selectedId) ?? eligible[0];
  const opponents = eligible.filter(participant => participant.id !== winner?.id);
  const opponent = opponents.find(participant => participant.id === opponentId) ?? opponents[0];
  const scene = (selectedScene === 'vs' || selectedScene === 'next') && !opponent ? 'result' : selectedScene;
  const { start, end } = bounds(scene, mode);
  const onProgress = useCallback((position: number, active: boolean) => {
    setTime(position); setPlaying(active);
    if (position >= end - .001 && !ended.current) { ended.current = true; stage.current?.seek(end); setPlaying(false); setFinished(true); }
  }, [end]);
  let winnerTeam = emptyTeam, opponentTeam = emptyTeam, adapterError = '';
  try { if (winner) winnerTeam = toPresentationTeam([winner]); if (opponent) opponentTeam = toPresentationTeam([opponent]); }
  catch (reason) { adapterError = reason instanceof Error ? reason.message : '参加者データを表示できません。'; }
  winnerTeam = { ...winnerTeam, faces: winnerTeam.faces.map(url => `${url}?refresh=${revision}-${sessionVersion}-${participants.map(p => `${p.id}:${p.version}`).join(",")}`) };
  opponentTeam = { ...opponentTeam, faces: opponentTeam.faces.map(url => `${url}?refresh=${revision}-${sessionVersion}-${participants.map(p => `${p.id}:${p.version}`).join(",")}`) };
  const teamKey = JSON.stringify([winnerTeam, opponentTeam]);
  useEffect(() => { ended.current = false; setFinished(false); setPhotoError(false); stage.current?.seek(start); }, [scene, mode, start, teamKey]);
  const replay = () => { ended.current = false; setFinished(false); stage.current?.seek(start); stage.current?.play(); };
  return <section className="live-preview"><header className="display-header"><div><p className="eyebrow">REHEARSAL / REGISTERED PARTICIPANTS</p><h1>登録写真で演出確認</h1><p>受付で登録した参加者をそのまま表示します。勝敗・抽選結果は保存しません。</p></div><button onClick={() => { setPhotoError(false); refresh(); }}>参加者を更新</button></header>
    {error && <p className="error" role="alert">{error}</p>}{adapterError && <p className="error" role="alert">{adapterError}</p>}
    {loading && <p role="status">参加者を取得しています…</p>}
    {excludedTests > 0 && <p className="hint">模擬カメラの自動試験画像は演出へ渡しません。</p>}
    {!loading && !winner && <div className="card empty"><h2>写真付き参加者の登録を待っています</h2><p>サンプルで代用せず、受付で登録された写真を表示します。</p><a className="button" href={scopedUrl('/checkin')}>受付で写真を登録</a></div>}
    {winner && !adapterError && <>
      <div className="live-selectors"><label>表示する参加者<select value={winner.id} onChange={event => setSelectedId(event.target.value)}>{eligible.map(participant => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></label>{opponent && <label>対戦相手（表示確認用）<select value={opponent.id} onChange={event => setOpponentId(event.target.value)}>{opponents.map(participant => <option value={participant.id} key={participant.id}>{participant.name}</option>)}</select></label>}</div>
      <p className="hint">{winner.name}の登録写真を使用中。{!opponent && 'VS・NEXT MATCHには写真付き参加者がもう1名必要です。'}</p>
      <nav className="live-scenes" aria-label="実参加者の演出を選択">{scenes.map(value => <button key={value} disabled={(value === 'vs' || value === 'next') && !opponent} aria-pressed={scene === value} onClick={() => setScene(value)}>{labels[value]}</button>)}</nav>
      {photoError && <p className="error" role="alert">写真を取得できませんでした。「参加者を更新」で再読み込みしてください。</p>}
      <section hidden={photoError} className="ap-screen" aria-label={`${labels[scene]}の実参加者演出`} onErrorCapture={event => { if (event.target instanceof HTMLImageElement) { stage.current?.pause(); setPhotoError(true); } }}>
        {scene === 'draw' || scene === 'champion' ? <FixtureStage key={`${scene}-${mode}-${teamKey}`} ref={stage} scene={scene} mode={mode} team={winnerTeam} eventLabel="登録参加者 · 表示確認専用" onProgress={onProgress} /> : <PostMatchStage key={`${scene}-${mode}-${teamKey}`} ref={stage} mode={mode} winnerTeam={winnerTeam} opponentTeam={opponentTeam} eventLabel="登録参加者 · 表示確認専用" onProgress={onProgress} />}
      </section>
      <div className="ap-controls"><h2>{labels[scene]}</h2><p role="status">{playing ? '再生中' : finished ? '再生完了' : '停止中'} · {Math.max(0, time - start).toFixed(1)}秒</p><div className="ap-actions"><button onClick={replay}>最初から再生</button><button disabled={playing || finished} onClick={() => stage.current?.play()}>再開</button><button disabled={!playing} onClick={() => stage.current?.pause()}>一時停止</button><button onClick={() => { ended.current = false; stage.current?.seek(end); }}>スキップ</button><label>モード<select value={mode} onChange={event => setMode(event.target.value as PresentationMode)}><option value="full">full</option><option value="short">short</option><option value="lite">lite</option></select></label></div><label className="ap-seek">確認位置<input aria-label="確認位置" type="range" min={start} max={end} step=".01" value={Math.min(end, Math.max(start,time))} onChange={event => { ended.current = false; setFinished(false); stage.current?.seek(Number(event.target.value)); }} /></label><p className="ap-note">演出の表示確認です。実際の大会結果ではありません。Bracket advanceは模式図です。</p></div>
    </>}
  </section>;
}
