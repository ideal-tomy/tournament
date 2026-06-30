import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import type { Database } from 'brackets-model';
import type { StageData } from './layout';

/** brackets-manager の完全 DB（真実源。stage/tournament 含む） */
export type BracketSnapshot = Database;

export function toStageData(db: Database | BracketSnapshot | StageData): StageData {
  return {
    group: (db.group ?? []) as StageData['group'],
    round: (db.round ?? []) as StageData['round'],
    match: (db.match ?? []) as StageData['match'],
    participant: (db.participant ?? []) as StageData['participant'],
  };
}

export function isFullSnapshot(snapshot: unknown): snapshot is BracketSnapshot {
  return (
    typeof snapshot === 'object' &&
    snapshot != null &&
    'stage' in snapshot &&
    Array.isArray((snapshot as BracketSnapshot).stage)
  );
}

export async function buildDoubleElimination(teamIds: string[]): Promise<BracketSnapshot> {
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

  return manager.get.stageData(0);
}

export function createManagerFromSnapshot(snapshot: BracketSnapshot | StageData): BracketsManager {
  if (!isFullSnapshot(snapshot)) {
    throw new Error(
      'ブラケット形式が古いです。抽選タブでブラケットを再生成してください',
    );
  }
  const storage = new InMemoryDatabase();
  storage.setData(snapshot);
  return new BracketsManager(storage);
}

export async function exportSnapshot(manager: BracketsManager): Promise<BracketSnapshot> {
  return manager.get.stageData(0);
}

/** Vitest / 開発用: 指定チーム数のスナップショット生成 */
export async function buildSnapshotForTeamCount(count: number): Promise<BracketSnapshot> {
  const teamIds = Array.from({ length: count }, (_, i) => `team-${i}`);
  return buildDoubleElimination(teamIds);
}
