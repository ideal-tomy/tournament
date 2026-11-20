import type { DrawState } from './DrawControl';

/** 優勝が付いたあと、演出が終わっていれば表彰へ進める。 */
export function ceremonyAutoStart(state: DrawState) {
  if (state.scene !== 'interval') return false;
  const flow = state.flow;
  const courts = flow?.courts;
  if (!flow?.championTeamId || !courts) return false;
  if ((flow.losersIntroRemainingSec ?? 0) > 0) return false;
  if (courts.spotlight) return false;
  if (courts.boards.some((board) => board.showing)) return false;
  if (courts.boards.some((board) => board.stage === 'call' || board.stage === 'live')) return false;
  return true;
}
