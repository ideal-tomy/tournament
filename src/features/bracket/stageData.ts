import type { Database } from 'brackets-model';
import type { StageData } from './layout';
export function toStageData(db: Database | StageData): StageData {
  return {
    group: (db.group ?? []) as StageData['group'],
    round: (db.round ?? []) as StageData['round'],
    match: (db.match ?? []) as StageData['match'],
    participant: (db.participant ?? []) as StageData['participant'],
  };
}

