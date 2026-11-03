import { useState } from 'react';
import { currentRunId, scopedUrl } from './api';
import { useRunSync } from './useRunSync';

const roleLabel: Record<string, string> = {
  checkin: '参加者受付',
  admin: '大会運営',
  display: '会場Display',
  rehearsal: '大会全体',
};

export default function RunContextBanner({ role, sessionVersion, compact = false }: { role: keyof typeof roleLabel; sessionVersion: number; compact?: boolean }) {
  const run = currentRunId();
  const sync = useRunSync(sessionVersion);
  const [copied, setCopied] = useState('');
  if (!run) return null;
  if (compact) {
    if (sync.state === 'mismatch' || sync.state === 'missing') return <p role="alert" className="card error">この大会は見つかりません。「大会を始める」の受付リンクから開き直してください。</p>;
    return null;
  }
  const short = run.slice(-12);
  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied('');
    }
  }
  return (
    <aside className="run-context" aria-label="大会ID">
      <p>
        <span className="run-context-label">{roleLabel[role]}</span>
        <span className="run-context-id" title={run}>
          大会ID …{short}
        </span>
      </p>
      {sync.state === 'mismatch' && (
        <p role="alert" className="error">URLの大会IDと、サーバーが返した大会ID（{sync.serverEventId}）が一致しません。Rehearsal の3リンクから開き直してください。</p>
      )}
      {sync.state === 'missing' && (
        <p role="alert" className="error">この大会IDは見つかりません。Rehearsal で準備した大会の3リンクから開き直してください。</p>
      )}
      <p className="run-context-hint">
        受付・運営・モニターで同じ大会IDのURLを開いてください。モニターは
        <a href={scopedUrl('/display')}>会場Display</a>
        、運営は
        <a href={scopedUrl('/admin')}>Admin</a>
        です。
      </p>
      <div className="run-context-actions">
        <button type="button" className="run-context-copy" onClick={() => void copy('url', location.href)}>
          {copied === 'url' ? 'URLをコピーしました' : 'この画面のURLをコピー'}
        </button>
        <button type="button" className="run-context-copy" onClick={() => void copy('id', run)}>
          {copied === 'id' ? '大会IDをコピーしました' : '大会IDをコピー'}
        </button>
        {role !== 'display' && (
          <a className="button" href={scopedUrl('/display')} target="_blank" rel="noreferrer">
            会場Displayを開く
          </a>
        )}
        {role === 'checkin' && (
          <a className="button primary" href={scopedUrl('/admin')}>
            運営画面を開く
          </a>
        )}
      </div>
    </aside>
  );
}
