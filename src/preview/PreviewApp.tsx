import { useCallback, useEffect, useRef, useState } from 'react';
import PostMatchStage, { type StageControls } from '../features/presentation/postMatch/PostMatchStage';
import { postMatchTiming } from '../features/presentation/postMatch/timing';
import type { PresentationMode } from '../types';
import FixtureStage, { fixtureDuration } from './FixtureStage';
import { labels, longWinner, sampleOpponent, sampleWinner, scenes, type Scene, type Selection } from './fixtures';

const query = new URLSearchParams(location.search);
const initialSelection: Selection = query.get('scene') === 'all' ? 'all' : scenes.find(s => s === query.get('scene')) ?? 'draw';
const initialMode: PresentationMode = query.get('mode') === 'short' ? 'short' : query.get('mode') === 'lite' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'lite' : 'full';
function bounds(scene: Scene, mode: PresentationMode) {
  const t = postMatchTiming(mode);
  if (scene === 'draw' || scene === 'champion') return { start: 0, end: fixtureDuration(scene, mode) };
  if (scene === 'result') return { start: 0, end: t.advance - .01 };
  if (scene === 'bracket') return { start: t.advance, end: t.approach - .01 };
  if (scene === 'vs') return { start: t.approach, end: t.impact + .49 };
  return { start: t.impact + .9, end: t.hold };
}
export default function PreviewApp() {
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PresentationMode>(initialMode);
  const [controls, setControls] = useState(query.get('controls') !== '0');
  const [longNames, setLongNames] = useState(query.get('fixture') === 'long');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [autoPlay, setAutoPlay] = useState(query.get('autoplay') === '1');
  const [fullscreenError, setFullscreenError] = useState('');
  const stage = useRef<StageControls>(null);
  const ended = useRef(false);
  const scene = selection === 'all' ? scenes[index] : selection;
  const { start, end } = bounds(scene, mode);
  const onProgress = useCallback((position: number, active: boolean) => {
    setTime(position);
    setPlaying(active);
    if (position >= end - .001 && !ended.current) {
      ended.current = true;
      stage.current?.seek(end);
      setPlaying(false);
      setFinished(true);
    }
  }, [end]);
  useEffect(() => {
    ended.current = false;
    setFinished(false);
    stage.current?.seek(start);
    if (autoPlay) stage.current?.play();
  }, [scene, selection, mode, longNames, start, autoPlay]);
  useEffect(() => {
    if (!finished || selection !== 'all' || scene === 'next' || scene === 'champion') return;
    const timeout = setTimeout(() => { setIndex(i => Math.min(i + 1, scenes.length - 1)); setAutoPlay(true); }, 650);
    return () => clearTimeout(timeout);
  }, [finished, selection, scene]);
  useEffect(() => {
    const params = new URLSearchParams({ scene: selection, mode });
    if (!controls) params.set('controls', '0');
    if (longNames) params.set('fixture', 'long');
    if (query.get('autoplay') === '1') params.set('autoplay', '1');
    history.replaceState(null, '', `/?${params}`);
  }, [selection, mode, controls, longNames]);
  const restart = () => {
    ended.current = false; setFinished(false);
    if (selection === 'all' && index !== 0) { setIndex(0); setAutoPlay(true); }
    else { stage.current?.seek(start); stage.current?.play(); }
  };
  const team = longNames ? longWinner : sampleWinner;
  return <main className={controls ? 'ap-app' : 'ap-app ap-monitor'}>
    {controls && <header className="ap-header"><p className="ap-eyebrow">TOURNAMENT / VISUAL LAB</p><h1>Animation Preview</h1><p>サンプル演出専用 · データの登録・更新は行いません</p></header>}
    <section className="ap-screen" aria-label={`${labels[scene]}のプレビュー`}>
      {scene === 'draw' || scene === 'champion' ? <FixtureStage key={`${scene}-${mode}-${longNames}`} ref={stage} scene={scene} mode={mode} team={team} onProgress={onProgress} /> : <PostMatchStage key={`${scene}-${mode}-${longNames}`} ref={stage} mode={mode} onProgress={onProgress} winnerTeam={team} opponentTeam={sampleOpponent} />}
    </section>
    {controls ? <section className="ap-controls" aria-label="演出操作">
      <div className="ap-control-heading"><h2>{labels[scene]}</h2><p role="status">{playing ? '再生中' : finished ? scene === 'next' ? '手動開始待ち' : '再生完了' : '停止中'} · {Math.max(0, time - start).toFixed(1)} / {(end - start).toFixed(1)}秒</p></div>
      <nav aria-label="演出を選択">{([...scenes, 'all'] as Selection[]).map(s => <button key={s} aria-pressed={selection === s} onClick={() => { setSelection(s); setIndex(0); setAutoPlay(false); }}>{labels[s]}</button>)}</nav>
      <div className="ap-options"><label>モード <select value={mode} onChange={e => { setMode(e.target.value as PresentationMode); setAutoPlay(false); }}><option value="full">full</option><option value="short">short</option><option value="lite">lite（光を抑える）</option></select></label><label><input type="checkbox" checked={longNames} onChange={e => setLongNames(e.target.checked)} />長い名前で確認</label></div>
      <div className="ap-actions"><button className="ap-primary" onClick={restart}>最初から再生</button><button disabled={playing || finished} onClick={() => stage.current?.play()}>再開</button><button disabled={!playing} onClick={() => stage.current?.pause()}>一時停止</button><button onClick={() => { ended.current = false; stage.current?.seek(end); }}>スキップ</button>{selection === 'all' && scene === 'next' && <button className="ap-primary" onClick={() => { setIndex(scenes.length - 1); setAutoPlay(true); }}>優勝演出へ進む</button>}</div>
      <label className="ap-seek">確認位置<input aria-label="確認位置" type="range" min={start} max={end} step=".01" value={Math.min(end, Math.max(start, time))} onChange={e => { ended.current = false; setFinished(false); stage.current?.seek(Number(e.target.value)); }} /></label>
      <div className="ap-actions"><button onClick={() => setControls(false)}>モニター表示</button><button onClick={async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); setFullscreenError(''); } catch { setFullscreenError('この端末では全画面表示を利用できません。モニター表示を使用してください。'); } }}>全画面を切り替え</button></div>
      {fullscreenError && <p role="status">{fullscreenError}</p>}
      <p className="ap-note">Bracket advanceは模式図です。Draw・Championは専用のサンプル演出です。本番Displayとの完全一致・端末間同期・音声は対象外です。通し再生もNEXT MATCHで停止します。</p>
    </section> : <button className="ap-restore" onClick={() => setControls(true)}>操作を表示</button>}
  </main>;
}
