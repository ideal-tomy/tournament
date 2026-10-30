import { useEffect, useState } from 'react';
import { api } from './api';

export default function ConnectionCheck() {
  const [status, setStatus] = useState('確認中…');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<{ ok: boolean }>('/api/health', { signal: controller.signal }),
      api<{ authenticated: boolean }>('/api/session', { signal: controller.signal }),
    ]).then(([health, session]) => {
      if (!controller.signal.aborted) setStatus(health.ok && session.authenticated ? 'Worker接続・セッション確認済み' : '接続状態を確認してください');
    }).catch(() => { if (!controller.signal.aborted) setStatus('接続できませんでした。再読み込みしてください。'); });
    return () => controller.abort();
  }, []);
  return <section className="card"><h1>Cloudflare接続確認</h1><p role="status">{status}</p><p>接続先：{location.origin}</p><p>この確認はWorkerと認証の疎通です。D1保存・R2写真の確認結果は実際の受付と大会で確認します。</p></section>;
}
