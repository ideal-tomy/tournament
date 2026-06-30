import { useCallback, useEffect, useState } from 'react';
import { fetchBracketDisplayMeta, hasBracket } from './bracketApi';
import { buildTeamVisuals, type TeamVisuals } from './teamFaces';
import type { StageData } from './layout';
import { displayMediaPreloader } from '../../lib/media';

interface BracketState {
  snapshot: StageData | null;
  visuals: TeamVisuals;
  currentMatchId: number | null;
  status: 'setup' | 'running' | 'finished';
}

const EMPTY_VISUALS: TeamVisuals = { faceUrlByTeamId: {}, labelByTeamId: {} };

export function useBracketDisplay(eventId: string | undefined) {
  const [state, setState] = useState<BracketState>({
    snapshot: null,
    visuals: EMPTY_VISUALS,
    currentMatchId: null,
    status: 'setup',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load() {
      if (!eventId) return;
      setLoading(true);
      setError(null);
      try {
        const meta = await fetchBracketDisplayMeta(eventId);
        if (cancelled) return;

        if (!hasBracket(meta.snapshot)) {
          setState({
            snapshot: null,
            visuals: EMPTY_VISUALS,
            currentMatchId: null,
            status: meta.status,
          });
          return;
        }

        const visuals = await buildTeamVisuals(eventId);
        if (cancelled) return;

        const urls = Object.values(visuals.faceUrlByTeamId).flat();
        if (urls.length > 0) await displayMediaPreloader.preloadAll(urls);

        if (cancelled) return;
        setState({
          snapshot: meta.snapshot,
          visuals,
          currentMatchId: meta.currentMatchId,
          status: meta.status,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'ブラケット読み込みに失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, tick]);

  return {
    snapshot: state.snapshot,
    faceUrlByTeamId: state.visuals.faceUrlByTeamId,
    labelByTeamId: state.visuals.labelByTeamId,
    currentMatchId: state.currentMatchId,
    eventStatus: state.status,
    hasBracket: hasBracket(state.snapshot),
    loading,
    error,
    reload,
  };
}
