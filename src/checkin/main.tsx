import MatchTransitionPage from './MatchTransitionPage';
import { StrictMode, useCallback, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, scopedUrl } from './api';
import RehearsalPage from './RehearsalPage';
import CheckinWorkspace from './CheckinWorkspace';
import DisplayPage from './DisplayPage';
import LiveShowPreviewPage from './LiveShowPreviewPage';
import HomePage from './HomePage';
import ConnectionCheck from './ConnectionCheck';
import './draw.css';
import './checkin.css';
import './rehearsal.css';

function Workspace({ onAuthRequired, sessionVersion }: { onAuthRequired(): void; sessionVersion: number }) {
  if (location.pathname === '/') return <HomePage />;
  if (location.pathname === '/cloudflare-check') return <ConnectionCheck />;
  return <TournamentWorkspace onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} />;
}

function TournamentWorkspace({ onAuthRequired, sessionVersion }: { onAuthRequired(): void; sessionVersion: number }) {
  const needsSelection = !new URLSearchParams(location.search).has('run')
    && ['/checkin', '/admin', '/display', '/show-preview', '/match-transition'].includes(location.pathname);
  const [selection, setSelection] = useState<'loading' | 'required' | 'ready'>(needsSelection ? 'loading' : 'ready');
  const [failure, setFailure] = useState('');
  useEffect(() => {
    if (!needsSelection) return;
    let cancelled = false;
    api<{ enabled: boolean }>('/api/rehearsal/config').then(value => {
      if (!cancelled) setSelection(value.enabled ? 'required' : 'ready');
    }).catch(reason => {
      if (cancelled) return;
      if (reason instanceof ApiError && reason.status === 404) setSelection('ready');
      else if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      else setFailure(reason instanceof Error ? reason.message : '接続できませんでした。');
    });
    return () => { cancelled = true; };
  }, [needsSelection, sessionVersion, onAuthRequired]);
  if (failure) return <section className="card"><p role="alert">{failure}</p><button onClick={() => location.reload()}>再接続</button></section>;
  if (selection === 'loading') return <p role="status">大会を確認しています…</p>;
  if (selection === 'required') return <section className="card"><h1>確認する大会を選んでください</h1><p>通しリハーサルで大会を準備し、その大会の「運営画面を開く」「Displayを別ウィンドウで開く」「参加者受付を開く」から進んでください。保存済み大会は run 付きURLから再開できます。</p><a className="button primary" href="/rehearsal">通しリハーサルを開く</a></section>;
  return location.pathname === '/match-transition' ? <MatchTransitionPage onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} /> : location.pathname === '/rehearsal' ? <RehearsalPage onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} /> : location.pathname === '/show-preview' ? <LiveShowPreviewPage onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} /> : location.pathname === '/display' || location.pathname === '/admin' ? <DisplayPage administration={location.pathname === '/admin'} onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} /> : <CheckinWorkspace onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} />;
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const onAuthRequired = useCallback(() => setAuthenticated(false), []);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    api('/api/session', { signal: controller.signal }).then(() => { if (!cancelled) { setAuthenticated(true); setInitialized(true); } }).catch(reason => { if (!cancelled && (!(reason instanceof ApiError) || reason.status !== 401)) setError(reason instanceof Error ? reason.message : '接続できませんでした。'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await api('/api/session', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }); setCode(''); setAuthenticated(true); setInitialized(true); setSessionVersion(value => value + 1); }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 401 ? '確認コードが一致しません。もう一度入力してください。' : reason instanceof Error ? reason.message : 'ログインできませんでした。'); }
    finally { setBusy(false); }
  }
  return <main>{location.pathname !== '/display' && <nav className="topbar" aria-label="大会ナビゲーション"><a href={scopedUrl('/')}>ホーム</a><a href={scopedUrl('/rehearsal')}>大会の全体確認</a><details><summary>個別画面</summary><a href={scopedUrl('/checkin')}>参加者受付</a><a href={scopedUrl('/admin')}>運営（Admin）</a><a href={scopedUrl('/display')}>会場Display</a></details><details><summary>開発ツール</summary><a href={scopedUrl('/show-preview')}>Animation Preview</a><a href={scopedUrl('/cloudflare-check')}>Cloudflare接続確認</a></details>{authenticated && <button onClick={async () => { try { await api('/api/session', { method: 'DELETE' }); location.reload(); } catch { setError('ログアウトできませんでした。再試行してください。'); } }}>ログアウト</button>}</nav>}
    {loading ? <p className="loading" role="status">接続を確認しています…</p> : <>
      <div hidden={!authenticated}>{initialized && <Workspace onAuthRequired={onAuthRequired} sessionVersion={sessionVersion} />}</div>
      {!authenticated && <section className="card login"><p className="eyebrow">TOURNAMENT / REHEARSAL</p><h1>確認コードを入力</h1><p className="intro">受付・参加者確認用のコードを入力してください。同じコードを各端末で使用できます。</p><form onSubmit={login}><label className="field">確認コード<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} value={code} onChange={e => setCode(e.target.value)} /></label>{error && <p role="alert" className="error">{error}</p>}<button type="submit" className="primary submit" disabled={busy || !code.trim()}>{busy ? '確認中…' : '確認して開く'}</button></form></section>}
    </>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
