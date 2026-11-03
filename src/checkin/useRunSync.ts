import { useEffect, useState } from 'react';
import { api, ApiError, currentRunId } from './api';

export type RunSync = { state: 'checking' | 'ok' | 'mismatch' | 'missing' | 'unknown'; serverEventId: string | null };

export function useRunSync(sessionVersion: number): RunSync {
  const [sync, setSync] = useState<RunSync>({ state: 'checking', serverEventId: null });
  useEffect(() => {
    const run = currentRunId();
    if (!run) return;
    const controller = new AbortController();
    api<{ eventId: string }>('/api/checkin/state', { signal: controller.signal })
      .then(value => setSync({ state: value.eventId === run ? 'ok' : 'mismatch', serverEventId: value.eventId }))
      .catch(reason => {
        if (controller.signal.aborted || (reason instanceof ApiError && reason.status === 401)) return;
        setSync({ state: reason instanceof ApiError && ['NOT_FOUND', 'RUN_REQUIRED'].includes(reason.code) ? 'missing' : 'unknown', serverEventId: null });
      });
    return () => controller.abort();
  }, [sessionVersion]);
  return sync;
}
