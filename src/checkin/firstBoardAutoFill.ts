import type { DrawState } from './DrawControl';

/** 演出が終わった空き台へ、順に次の試合を自動で入れる。 */
export function firstBoardAutoFill(state: DrawState) {
  if (state.scene !== 'interval') return null;
  const flow = state.flow;
  const courts = flow?.courts;
  if (!flow || !courts || !flow.nextMatch || flow.championTeamId) return null;
  if ((flow.losersIntroRemainingSec ?? 0) > 0) return null;
  // 決勝の再試合は直前の決勝と同じ台で待ち、別の台に先取りさせない。
  const finalBoard = courts.boards.find((board) => board.match?.final && board.stage === 'result');
  if (finalBoard) return finalBoard.showing ? null : finalBoard.board;
  return courts.boards.find((board) => !board.showing &&
    ((board.stage === 'idle' && board.match == null) || board.stage === 'result'))?.board ?? null;
}
