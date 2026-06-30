import { useCallback, useEffect, useRef, useState } from 'react';
import type { BracketSnapshot } from '../bracket/manager';
import {
  confirmMatchResult,
  fetchProgressionState,
  isProgressionError,
  skipEffects,
  undoToSnapshot,
  type ProgressionState,
} from './progressionApi';
import { countPlayableMatches } from './progression';

interface UseProgressionResult {
  state: ProgressionState | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  canUndo: boolean;
  reload: () => void;
  confirmWinner: (matchId: number, winnerSlot: 0 | 1) => Promise<void>;
  undo: () => Promise<void>;
  skipEffect: () => Promise<void>;
}

export function useProgression(eventId: string | undefined): UseProgressionResult {
  const [state, setState] = useState<ProgressionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const undoRef = useRef<{
    snapshot: BracketSnapshot;
    currentMatchId: number | null;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchProgressionState(eventId!);
        if (cancelled) return;
        setState(next);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '進行状態の取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, tick]);

  async function confirmWinner(matchId: number, winnerSlot: 0 | 1) {
    if (!eventId || !state) return;
    setBusy(true);
    setError(null);
    try {
      undoRef.current = {
        snapshot: structuredClone(state.snapshot),
        currentMatchId: state.currentMatchId,
      };
      setCanUndo(true);

      const result = await confirmMatchResult(
        eventId,
        matchId,
        winnerSlot,
        state.currentMatchId,
      );

      setState({
        snapshot: result.snapshot,
        stageView: result.stageView,
        currentMatchId: result.currentMatchId,
        status: result.status,
        remainingMatches:
          result.status === 'finished' ? 0 : countPlayableMatches(result.stageView),
        championTeamId: result.championTeamId,
      });
    } catch (e) {
      undoRef.current = null;
      setCanUndo(false);
      setError(
        isProgressionError(e)
          ? e.message
          : e instanceof Error
            ? e.message
            : '勝敗確定に失敗しました',
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!eventId || !undoRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const restored = await undoToSnapshot(
        eventId,
        undoRef.current.snapshot,
        undoRef.current.currentMatchId,
      );
      undoRef.current = null;
      setCanUndo(false);
      setState(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'undo に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function skipEffect() {
    if (!eventId) return;
    try {
      await skipEffects(eventId);
    } catch (e) {
      setError(e instanceof Error ? e.message : '演出スキップ送信に失敗しました');
    }
  }

  return {
    state,
    loading,
    error,
    busy,
    canUndo,
    reload,
    confirmWinner,
    undo,
    skipEffect,
  };
}
