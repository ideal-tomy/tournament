import { useCallback, useEffect, useState } from 'react';
import { listParticipants } from './registrationApi';
import type { ParticipantRow } from '../../types';

export function useParticipants(eventId: string | undefined) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      setParticipants(await listParticipants(eventId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '参加者一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { participants, loading, error, refresh };
}
