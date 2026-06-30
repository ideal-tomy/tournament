import { createRehearsalEvent } from '../../lib/event';
import { addParticipant } from '../registration/registrationApi';
import { confirmDrawAndBuildBracket } from '../draw/drawApi';
import { makeBalancedTeams, type DrawStrategy } from '../draw/draw';
import { confirmMatchResult, fetchProgressionState } from '../progression/progressionApi';
import { DUMMY_PARTICIPANTS, createDummyFaceBlob } from './dummyData';

export interface RehearsalProgress {
  step: string;
  detail?: string;
}

export interface RehearsalResult {
  eventId: string;
  eventName: string;
  matchesPlayed: number;
}

const DEFAULT_MATCH_COUNT = 0;
const DRAW_STRATEGY: DrawStrategy = 'trio';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runRehearsal(
  onProgress: (p: RehearsalProgress) => void,
  matchCount = DEFAULT_MATCH_COUNT,
): Promise<RehearsalResult> {
  onProgress({ step: 'リハーサルイベント作成' });
  const event = await createRehearsalEvent();

  const participantIds: string[] = [];
  const nameById = new Map<string, string>();

  for (const spec of DUMMY_PARTICIPANTS) {
    onProgress({ step: '参加者登録', detail: spec.name });
    const blob = await createDummyFaceBlob(spec.label, spec.color);
    const id = await addParticipant(event.id, spec.name, spec.rating, blob, blob);
    participantIds.push(id);
    nameById.set(id, spec.name);
  }

  onProgress({ step: '抽選・ブラケット生成' });
  const rated = DUMMY_PARTICIPANTS.map((spec, i) => ({
    id: participantIds[i],
    rating: spec.rating,
  }));
  const teams = makeBalancedTeams(rated, DRAW_STRATEGY);
  await confirmDrawAndBuildBracket(event.id, teams, DRAW_STRATEGY, nameById);

  let matchesPlayed = 0;
  for (let i = 0; i < matchCount; i++) {
    const state = await fetchProgressionState(event.id);
    if (!state?.currentMatchId) {
      onProgress({ step: '試合進行', detail: '次の試合がありません（終了）' });
      break;
    }

    const matchId = state.currentMatchId;
    onProgress({ step: `試合 ${i + 1} 確定`, detail: `match #${matchId}` });
    await confirmMatchResult(event.id, matchId, 0, state.currentMatchId);
    matchesPlayed += 1;
    await delay(400);
  }

  onProgress({ step: '完了', detail: `${matchesPlayed} 試合確定 + broadcast` });

  return {
    eventId: event.id,
    eventName: event.name,
    matchesPlayed,
  };
}
