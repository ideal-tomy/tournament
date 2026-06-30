import { useCallback, useEffect, useState } from 'react';
import {
  getEventIdFromUrl,
  getOrCreateActiveEvent,
  syncEventIdToUrl,
  type ActiveEvent,
} from '../lib/event';

interface UseActiveEventResult {
  event: ActiveEvent | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useActiveEvent(): UseActiveEventResult {
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const active = await getOrCreateActiveEvent(getEventIdFromUrl());
        if (cancelled) return;
        syncEventIdToUrl(active.id);
        setEvent(active);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message: unknown }).message)
              : 'イベント取得に失敗しました';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { event, loading, error, reload };
}
