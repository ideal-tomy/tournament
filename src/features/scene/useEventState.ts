import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EventStateRow } from '../../types';

const POLL_MS = 1500;

export function useEventState(eventId: string | undefined) {
  const [state, setState] = useState<EventStateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelStatus, setChannelStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');
  const seqRef = useRef(0);

  const applyIncoming = useCallback((row: EventStateRow) => {
    setState((prev) => {
      if (prev && row.scene_seq < prev.scene_seq) return prev;
      if (
        prev &&
        row.scene_seq === prev.scene_seq &&
        prev.scene === row.scene &&
        prev.updated_at === row.updated_at
      ) {
        return prev;
      }
      seqRef.current = row.scene_seq;
      return row;
    });
  }, []);

  const reload = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!eventId) return;
      if (!opts?.quiet) {
        setLoading(true);
        setError(null);
      }
      try {
        const { data, error: qErr } = await supabase
          .from('event_state')
          .select('*')
          .eq('event_id', eventId)
          .maybeSingle();
        if (qErr) throw qErr;
        if (data) {
          applyIncoming(data as EventStateRow);
        } else if (!opts?.quiet) {
          setState(null);
          seqRef.current = 0;
        }
      } catch (e) {
        if (!opts?.quiet) {
          setError(e instanceof Error ? e.message : 'event_state 取得失敗');
        }
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [eventId, applyIncoming],
  );

  useEffect(() => {
    seqRef.current = 0;
    setState(null);
    void reload();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event_state:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_state',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as EventStateRow | undefined;
          if (row && typeof row.scene_seq === 'number') {
            applyIncoming(row);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setChannelStatus('error');
        else if (status === 'CLOSED') setChannelStatus('disconnected');
        else setChannelStatus('connecting');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, applyIncoming]);

  useEffect(() => {
    if (!eventId) return;
    const id = window.setInterval(() => {
      void reload({ quiet: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [eventId, reload]);

  useEffect(() => {
    if (!eventId) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void reload({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [eventId, reload]);

  return { state, loading, error, reload, applyIncoming, channelStatus };
}
