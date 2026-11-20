import type { DrawState } from './DrawControl';

/** 台1だけ、演出が終わった空きへ次の試合を自動で入れる。 */
export function firstBoardAutoFill(state: DrawState) {
  if (state.scene !== 'interval') return false;
  const flow = state.flow;
  const courts = flow?.courts;
  if (!flow || !courts || !flow.nextMatch) return false;
  if ((flow.losersIntroRemainingSec ?? 0) > 0) return false;
  const board = courts.boards.find((item) => item.board === 1);
  if (!board || board.showing) return false;
  if (board.stage === 'idle' && board.match == null) return true;
  return board.stage === 'result';
}
