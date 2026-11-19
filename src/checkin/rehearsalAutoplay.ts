import { rehearsalTiming, type RehearsalTimingPreset } from '../lib/rehearsalTiming';
import type { DrawState } from './DrawControl';

export type AutoplayCommand = {
  path: string;
  body: { requestId: string; expectedVersion?: number; expectedRevision?: number; winnerSlot?: number; board?: number; mode?: string };
};

type Status = DrawState & { checkinStatus: string; checkinRevision: number; timingPreset?: RehearsalTimingPreset };

/** 次に送る運営コマンド。instant の台進行・単独試合・表彰まで一通り。 */
export function nextRehearsalCommand(
  state: Status,
  matchSince: { id: number; at: number } | null,
  now = Date.now(),
): { command: AutoplayCommand | null; matchSince: { id: number; at: number } | null } {
  const body = { requestId: crypto.randomUUID(), expectedVersion: state.version };
  const timing = rehearsalTiming(state.timingPreset ?? 'show');

  if (state.checkinStatus === 'open') {
    return { command: { path: '/api/checkin/close', body: { requestId: crypto.randomUUID(), expectedRevision: state.checkinRevision } }, matchSince };
  }
  if (!state.session) {
    return { command: { path: '/api/draw/pairs', body: { ...body, mode: 'auto' } }, matchSince };
  }
  if (state.scene === 'idle') {
    return { command: { path: '/api/draw/start', body }, matchSince };
  }

  if (state.scene === 'interval' && state.flow?.courts) {
    const boards = state.flow.courts.boards;
    const call = boards.find(b => b.stage === 'call' && b.matchId != null);
    if (call) {
      return { command: { path: '/api/tournament/court-start', body: { ...body, board: call.board } }, matchSince };
    }
    const live = boards.find(b => b.stage === 'live');
    if (live) {
      return { command: { path: '/api/tournament/court-winner', body: { ...body, board: live.board, winnerSlot: 0 } }, matchSince };
    }
    if (state.flow.twenty?.promptSwitch) {
      return { command: { path: '/api/tournament/courts-parallel', body }, matchSince };
    }
    const result = boards.find(b => b.stage === 'result');
    if (result) {
      return { command: { path: '/api/tournament/court-next', body: { ...body, board: result.board } }, matchSince };
    }
    const idle = boards.find(b => b.stage === 'idle' && b.matchId == null);
    if (idle && (!state.flow.twenty || state.flow.nextMatch)) {
      return { command: { path: '/api/tournament/court-next', body: { ...body, board: idle.board } }, matchSince };
    }
    if (state.flow.courts.spotlight && timing.vsHold > 0) {
      return { command: null, matchSince };
    }
    return { command: null, matchSince };
  }

  if (state.flow?.canAdvance) {
    return { command: { path: '/api/tournament/advance', body }, matchSince };
  }
  if (state.flow?.canGameStart) {
    return { command: { path: '/api/tournament/game-start', body }, matchSince };
  }
  if (state.flow?.canStart && state.elapsedSeconds >= state.durationSec + timing.vsHold) {
    return { command: { path: '/api/tournament/start', body }, matchSince };
  }
  if (state.scene === 'match_live' && state.flow?.currentMatch) {
    const id = state.flow.currentMatch.id;
    const since = matchSince?.id === id ? matchSince : { id, at: now };
    if (now - since.at >= timing.match * 1000) {
      return { command: { path: '/api/tournament/winner', body: { ...body, winnerSlot: 0 } }, matchSince: since };
    }
    return { command: null, matchSince: since };
  }

  if (['draw', 'bracket', 'vs_card', 'result', 'award', 'interval', 'finished'].includes(state.scene)) {
    return { command: null, matchSince };
  }
  throw new Error(`未対応の大会状態：${state.scene}`);
}