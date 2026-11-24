import {
  buildOrthogonalConnectorPath,
  computeBracketLayout,
  findParentMatch,
  fullBoardFocus,
  isConnectorHighlighted,
  resolveTeamId,
  type BracketBoardSide,
  type StageData,
} from './layout';
import { getMatchBracketKind } from '../progression/tiers';

function boardSideForMatch(data: StageData, matchId: number): BracketBoardSide {
  const match = data.match.find((row) => row.id === matchId);
  if (!match) return 'winners';
  const kind = getMatchBracketKind(data, match);
  if (kind === 'loser') return 'losers';
  if (kind === 'grand_final') return 'grand_final';
  return 'winners';
}

function layoutFocusForAdvance(data: StageData, boardSide: BracketBoardSide, matchId: number) {
  const attachGrandFinal =
    (boardSide === 'winners' || boardSide === 'losers') && findParentMatch(data, matchId) == null;
  return fullBoardFocus(attachGrandFinal);
}

/** Locate a committed winner's actual source and destination. No bracket decisions are made here. */
export function resolveResultAdvance(before: StageData, after: StageData, matchId: number, winnerTeamId: string) {
  const original = before.match.find((m) => m.id === matchId);
  const completed = after.match.find((m) => m.id === matchId);
  if (!original || !completed || completed.status < 4) return null;
  const winner =
    completed.opponent1?.result === 'win'
      ? completed.opponent1
      : completed.opponent2?.result === 'win'
        ? completed.opponent2
        : null;
  if (!winner || resolveTeamId(winner.id, after.participant) !== winnerTeamId) return null;
  const boardSide = boardSideForMatch(after, matchId);
  const layout = computeBracketLayout(after, undefined, boardSide, layoutFocusForAdvance(after, boardSide, matchId));
  const source = layout.byId[matchId];
  if (!source) return null;
  const connector = layout.connectors.find(
    (c) => c.kind === 'advance' && c.fromMatchId === matchId && isConnectorHighlighted(c, after),
  );
  if (!connector) return null;
  const destination = layout.byId[connector.toMatchId];
  const sourceSlot = source.slots.find((s) => s.teamRef === winner.id);
  const targetSlot = destination?.slots.find((s) => s.teamRef === winner.id);
  if (!sourceSlot || !targetSlot) return null;
  return {
    layout,
    boardSide,
    sourceMatchId: matchId,
    targetMatchId: connector.toMatchId,
    sourceSlot: sourceSlot.slot,
    targetSlot: targetSlot.slot,
    source: connector.from,
    target: connector.to,
    path: buildOrthogonalConnectorPath(connector.from, connector.to),
    sourceRound: source.round,
    attachGrandFinal: Boolean(layoutFocusForAdvance(after, boardSide, matchId)?.attachGrandFinal),
  };
}

/**
 * ウィナーズ敗者がルーザーズ枠へ入った先だけを返す。
 * 送り元からの線は描かないので、試合とスロットだけを渡す。
 */
export function resolveLoserDropPlacement(
  before: StageData,
  after: StageData,
  matchId: number,
  loserTeamId: string,
): { targetMatchId: number; targetSlot: 0 | 1 } | null {
  const completed = after.match.find((m) => m.id === matchId);
  if (!completed || completed.status < 4) return null;
  if (getMatchBracketKind(after, completed) !== 'winner') return null;
  const loserParticipant =
    completed.opponent1?.result === 'loss'
      ? completed.opponent1
      : completed.opponent2?.result === 'loss'
        ? completed.opponent2
        : null;
  if (!loserParticipant?.id) return null;
  if (resolveTeamId(loserParticipant.id, after.participant) !== loserTeamId) return null;

  for (const match of after.match) {
    if (getMatchBracketKind(after, match) !== 'loser') continue;
    for (const slot of [0, 1] as const) {
      const afterOpp = slot === 0 ? match.opponent1 : match.opponent2;
      if (afterOpp?.id !== loserParticipant.id) continue;
      const beforeMatch = before.match.find((row) => row.id === match.id);
      const beforeOpp = beforeMatch
        ? slot === 0
          ? beforeMatch.opponent1
          : beforeMatch.opponent2
        : null;
      if (beforeOpp?.id === loserParticipant.id) continue;
      return { targetMatchId: match.id, targetSlot: slot };
    }
  }
  return null;
}
