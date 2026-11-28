import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { DrawState } from './DrawControl';
import { firstBoardAutoFill } from './firstBoardAutoFill';
import { preparePortraits } from './portraitCache';
/** Which board beat is on screen, and which boards still wait for theirs. Advances with time, not version. */
export function courtBeat(state: DrawState) {
  const courts = state.flow?.courts, spot = courts?.spotlight;
  const beat = !spot ? ''
    : spot.kind === 'losers-intro' ? 'bracket'
    : spot.kind === 'winner' && spot.elapsed >= spot.winnerSec ? 'bracket'
    : spot.kind;
  const phase = spot ? `${spot.id}:${beat}` : '';
  return `${phase}|${courts?.boards.map(b => b.showing ? 1 : 0).join('') ?? ''}`;
}

/** Fields that change while the version stays the same: time gates open without a new write. */
function same(previous: DrawState, next: DrawState) {
  return previous.version === next.version && previous.checkinRevision === next.checkinRevision && previous.openingVersion === next.openingVersion
    && previous.participants.length === next.participants.length
    && previous.flow?.canStart === next.flow?.canStart && previous.flow?.canGameStart === next.flow?.canGameStart
    && previous.flow?.canAdvance === next.flow?.canAdvance && previous.canComplete === next.canComplete
    && courtBeat(previous) === courtBeat(next);
}

export function useTournamentState(onAuthRequired: () => void, sessionVersion: number, { automaticAdvance = false, portraits = true }: { automaticAdvance?: boolean; portraits?: boolean } = {}) {
  const [state, setState] = useState<DrawState | null>(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const filled = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false, inFlight: AbortController | null = null;
    const lifetime = new AbortController();
    async function poll(force = false) {
      if (cancelled || document.hidden) return;
      // A request suspended while the phone slept can hang until timeout; a fresh look replaces it.
      if (inFlight) { if (!force) return; inFlight.abort(); }
      const controller = new AbortController(); inFlight = controller;
      const abort = () => controller.abort();
      lifetime.signal.addEventListener('abort', abort, { once: true });
      try {
        let next = await api<DrawState>('/api/draw/state', { signal: controller.signal });
        const fillBoard = firstBoardAutoFill(next);
        if (fillBoard != null && filled.current !== next.version) {
          try {
            const board = fillBoard;
            next = await api<DrawState>('/api/tournament/court-next', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: next.version, board }), signal: controller.signal });
            filled.current = null;
          } catch (reason) {
            if (!(reason instanceof ApiError) || !['VERSION_CONFLICT', 'SPOTLIGHT_PLAYING', 'LOSERS_INTRO_PLAYING'].includes(reason.code)) {
              if (reason instanceof ApiError && reason.code === 'NO_PLAYABLE_MATCH') filled.current = next.version;
              else throw reason;
            }
          }
        }
        if (automaticAdvance && next.flow?.canAdvance && next.scene !== 'award' && !(next.scene === 'result' && next.flow.championTeamId)) next = await api<DrawState>('/api/tournament/advance', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: next.version }), signal: controller.signal });
        if (portraits) next = await preparePortraits(next, controller.signal);
        if (!cancelled && inFlight === controller) { setState(previous => previous && same(previous, next) ? previous : next); setError(''); }
      } catch (reason) {
        if (controller.signal.aborted || cancelled) return;
        if (reason instanceof ApiError && ['VERSION_CONFLICT', 'SCENE_NOT_FINISHED'].includes(reason.code)) return;
        setError(reason instanceof Error ? reason.message : '大会の状態を取得できませんでした。');
        if (reason instanceof ApiError && reason.status === 401) onAuthRequired();
      } finally {
        lifetime.signal.removeEventListener('abort', abort);
        if (inFlight === controller) inFlight = null;
      }
    }
    const look = () => void poll(true);
    void poll();
    const timer = setInterval(() => void poll(), 1000);
    document.addEventListener('visibilitychange', look);
    window.addEventListener('pageshow', look);
    window.addEventListener('focus', look);
    window.addEventListener('online', look);
    return () => {
      cancelled = true; lifetime.abort(); clearInterval(timer);
      document.removeEventListener('visibilitychange', look);
      window.removeEventListener('pageshow', look);
      window.removeEventListener('focus', look);
      window.removeEventListener('online', look);
    };
  }, [onAuthRequired, sessionVersion, revision, automaticAdvance, portraits]);
  return { state, setState, error, refresh: useCallback(() => setRevision(v => v + 1), []) };
}
