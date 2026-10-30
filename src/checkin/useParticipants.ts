import { useEffect, useState } from 'react';
import { api, ApiError, type Participant } from './api';
export function useParticipants(onAuthRequired: () => void, sessionVersion: number, allowDiagnostics = false) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [checkin, setCheckin] = useState<{status: 'open' | 'closed'; revision: number} | null>(null);
  const [excludedTests, setExcludedTests] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [updated, setUpdated] = useState('');
  const diagnostics = allowDiagnostics && new URLSearchParams(location.search).get('includeTestData') === '1';
  useEffect(() => {
    let cancelled = false, fetching = false;
    const controller = new AbortController();
    async function refresh() {
      if (cancelled || fetching || document.hidden) return;
      fetching = true;
      try {
        const result = await api<{ participants: Participant[]; excludedTestParticipants: number; checkin: {status:'open'|'closed'; revision:number} }>(`/api/participants${diagnostics ? '?includeTestData=1' : ''}`, { signal: controller.signal });
        if (!cancelled) { setParticipants(result.participants); setCheckin(result.checkin); setExcludedTests(result.excludedTestParticipants); setError(''); setUpdated(new Date().toLocaleTimeString('ja-JP')); }
      } catch (reason) {
        if (!cancelled) { setError(reason instanceof Error ? reason.message : '参加者を取得できませんでした。'); if (reason instanceof ApiError && reason.status === 401) onAuthRequired(); }
      } finally { fetching = false; if (!cancelled) setLoading(false); }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [revision, sessionVersion, onAuthRequired, diagnostics]);
  return { checkin, participants, excludedTests, error, loading, revision, updated, refresh: () => setRevision(value => value + 1) };
}
