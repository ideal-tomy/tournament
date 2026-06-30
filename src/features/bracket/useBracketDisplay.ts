import { useCallback, useEffect, useState } from 'react';
import { fetchBracketSnapshot, hasBracket } from './bracketApi';
import { buildTeamVisuals, type TeamVisuals } from './teamFaces';
import type { StageData } from './layout';
import { preloadImages } from '../../lib/media';

interface BracketState {
  snapshot: StageData | null;
  visuals: TeamVisuals;
}

const EMPTY_VISUALS: TeamVisuals = { faceUrlByTeamId: {}, labelByTeamId: {} };

export function useBracketDisplay(eventId: string | undefined) {
  const [state, setState] = useState<BracketState>({
    snapshot: null,
    visuals: EMPTY_VISUALS,
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
        const snapshot = await fetchBracketSnapshot(eventId);
        if (cancelled) return;

        if (!hasBracket(snapshot)) {
          setState({ snapshot: null, visuals: EMPTY_VISUALS });
          return;
        }

        const visuals = await buildTeamVisuals(eventId);
        if (cancelled) return;

        const urls = Object.values(visuals.faceUrlByTeamId).flat();
        if (urls.length > 0) await preloadImages(urls);

        if (cancelled) return;
        setState({ snapshot, visuals });
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
    hasBracket: hasBracket(state.snapshot),
    loading,
    error,
    reload,
  };
}
