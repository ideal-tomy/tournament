import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Database } from 'brackets-model';
import type { StageData } from './layout';

export function toStageData(db: Database): StageData {
  return {
    group: (db.group ?? []) as StageData['group'],
    round: (db.round ?? []) as StageData['round'],
    match: (db.match ?? []) as StageData['match'],
    participant: (db.participant ?? []) as StageData['participant'],
  };
}

export async function buildDoubleElimination(teamIds: string[]): Promise<StageData> {
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);

  const size = 1 << Math.ceil(Math.log2(Math.max(2, teamIds.length)));
  const seeding: (string | null)[] = [...teamIds];
  while (seeding.length < size) seeding.push(null);

  await manager.create.stage({
    tournamentId: 0,
    name: 'Double Elimination',
    type: 'double_elimination',
    seeding,
    settings: { grandFinal: 'double', seedOrdering: ['natural'], balanceByes: true },
  });

  const data = await manager.get.stageData(0);
  return toStageData(data);
}

export function createManagerFromSnapshot(snapshot: StageData): BracketsManager {
  const storage = new InMemoryDatabase();
  storage.setData(snapshot as Database);
  return new BracketsManager(storage);
}

export async function exportSnapshot(manager: BracketsManager): Promise<StageData> {
  const data = await manager.get.stageData(0);
  return toStageData(data);
}

/** Vitest / 開発用: 指定チーム数のスナップショット生成 */
export async function buildSnapshotForTeamCount(count: number): Promise<StageData> {
  const teamIds = Array.from({ length: count }, (_, i) => `team-${i}`);
  return buildDoubleElimination(teamIds);
}
