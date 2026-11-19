import { Status } from 'brackets-model';
import {
  buildDoubleElimination,
  createManagerFromSnapshot,
  exportSnapshot,
  toStageData,
  type BracketSnapshot,
} from '../features/bracket/manager';
import { getMatchBracketKind, getMatchRoundLabel } from '../features/progression/tiers';

export interface VenueAdvance {
  before: BracketSnapshot;
  after: BracketSnapshot;
  matchId: number;
  round: number;
  kind: 'winner' | 'loser' | 'grand_final';
  teamA: string;
  teamB: string;
  winnerTeamId: string;
  loserTeamId: string;
  label: string;
}

function teamName(data: ReturnType<typeof toStageData>, participantId: number | null | undefined) {
  if (participantId == null) return null;
  return data.participant.find((row) => row.id === participantId)?.name ?? null;
}

/** 仮の20組で、勝者が表を進む場面を先頭から順に作る。保存された大会は触らない。 */
export async function buildVenueAdvances(teamIds: string[], limit = 6): Promise<VenueAdvance[]> {
  let snapshot = await buildDoubleElimination(teamIds);
  const steps: VenueAdvance[] = [];
  for (let index = 0; index < limit; index += 1) {
    const data = toStageData(snapshot);
    const match = data.match.find(
      (row) => row.status === Status.Ready && row.opponent1?.id != null && row.opponent2?.id != null,
    );
    if (!match) break;
    const teamA = teamName(data, match.opponent1?.id);
    const teamB = teamName(data, match.opponent2?.id);
    if (!teamA || !teamB) break;
    const manager = createManagerFromSnapshot(snapshot);
    await manager.update.match({
      id: match.id,
      opponent1: { result: 'win' },
      opponent2: { result: 'loss' },
    });
    const after = await exportSnapshot(manager);
    const kind = getMatchBracketKind(data, match);
    const round = getMatchRoundLabel(data, match);
    const place = kind === 'loser' ? 'ルーザーズ' : kind === 'grand_final' ? 'グランドファイナル' : 'ウィナーズ';
    steps.push({
      before: snapshot,
      after,
      matchId: match.id,
      round,
      kind,
      teamA,
      teamB,
      winnerTeamId: teamA,
      loserTeamId: teamB,
      label: `${place} ${round}回戦 · ${index + 1}/${limit}`,
    });
    snapshot = after;
  }
  return steps;
}
