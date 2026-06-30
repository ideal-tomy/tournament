import { Status } from 'brackets-model';
import {
  findFeederMatches,
  findParentMatch,
  isMatchCompleted,
  type BMMatch,
  type StageData,
} from '../bracket/layout';
import { getSlotTeamUuid } from '../progression/progression';

export interface AdvanceEffectPayload {
  nextMatchId: number;
  teamAId: string;
  teamBId: string;
  feederMatchIds: [number, number];
}

function getWinnerTeamId(data: StageData, match: BMMatch): string | null {
  if (match.opponent1?.result === 'win') return getSlotTeamUuid(data, match, 0);
  if (match.opponent2?.result === 'win') return getSlotTeamUuid(data, match, 1);
  return null;
}

function feederSortKey(match: BMMatch): number {
  return match.number;
}

/**
 * 同エリアの両フィーダーが確定したタイミングでのみ、次試合の演出ペイロードを返す。
 * 片方だけ確定の場合は null（演出なし）。
 */
export function detectAdvanceEffect(
  data: StageData,
  confirmedMatchId: number,
): AdvanceEffectPayload | null {
  const confirmed = data.match.find((m) => m.id === confirmedMatchId);
  if (!confirmed || confirmed.status < Status.Completed) return null;

  const parent = findParentMatch(data, confirmedMatchId);
  if (!parent) return null;

  const feeders = findFeederMatches(data, parent.id);
  if (feeders.length < 2) return null;
  if (!feeders.some((m) => m.id === confirmedMatchId)) return null;
  if (!feeders.every((m) => isMatchCompleted(m))) return null;

  const sorted = [...feeders].sort((a, b) => feederSortKey(a) - feederSortKey(b));
  const teamAId = getWinnerTeamId(data, sorted[0]);
  const teamBId = getWinnerTeamId(data, sorted[1]);
  if (!teamAId || !teamBId) return null;

  return {
    nextMatchId: parent.id,
    teamAId,
    teamBId,
    feederMatchIds: [sorted[0].id, sorted[1].id],
  };
}
