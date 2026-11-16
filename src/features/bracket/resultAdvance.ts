import {
  buildOrthogonalConnectorPath,
  computeBracketLayout,
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
  const layout = computeBracketLayout(after, undefined, boardSide);
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
  };
}
