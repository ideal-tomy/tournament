import { getLatestRehearsalEvent, createRehearsalEvent } from '../../lib/event';
import { confirmDrawAndBuildBracket } from '../draw/drawApi';
import { makeBalancedTeams, type DrawStrategy } from '../draw/draw';
import { addParticipant, listParticipants } from '../registration/registrationApi';
import { confirmMatchResult, fetchProgressionState } from '../progression/progressionApi';
import {
  DUMMY_PARTICIPANTS,
  loadRehearsalFaceBlob,
  REHEARSAL_PARTICIPANT_COUNT,
} from './dummyData';

export interface RehearsalProgress {
  step: string;
  detail?: string;
}

export interface RehearsalResult {
  eventId: string;
  eventName: string;
  matchesPlayed: number;
  participantCount: number;
  teamCount: number;
  reused?: boolean;
}

const DRAW_STRATEGY: DrawStrategy = 'trio';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rebuildBracketFromParticipants(
  eventId: string,
  onProgress: (p: RehearsalProgress) => void,
): Promise<{ teamCount: number }> {
  onProgress({ step: '参加者を確認' });
  const participants = await listParticipants(eventId);
  if (participants.length < 2) {
    throw new Error('参加者が不足しています。新規リハーサルを実行してください。');
  }

  const rated = participants.map((p) => ({
    id: p.id,
    rating: p.rating ?? 0,
  }));
  const nameById = new Map(participants.map((p) => [p.id, p.name]));
  const teams = makeBalancedTeams(rated, DRAW_STRATEGY);

  onProgress({
    step: '抽選・ブラケット再生成',
    detail: `${participants.length} 名 · ${teams.length} チーム`,
  });
  await confirmDrawAndBuildBracket(eventId, teams, DRAW_STRATEGY, nameById);

  return { teamCount: teams.length };
}

/** 既存リハーサルイベントの参加者を維持し、試合だけ最初から */
export async function reuseRehearsal(
  onProgress: (p: RehearsalProgress) => void,
  matchCount = 0,
): Promise<RehearsalResult> {
  onProgress({ step: '最新リハーサルを検索' });
  const event = await getLatestRehearsalEvent();
  if (!event) {
    throw new Error('再利用できるリハーサルがありません。新規作成してください。');
  }

  const { teamCount } = await rebuildBracketFromParticipants(event.id, onProgress);

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

  const participants = await listParticipants(event.id);
  onProgress({
    step: '完了',
    detail: `${participants.length} 名 / ${teamCount} チーム · 再利用 · ${matchesPlayed} 試合確定`,
  });

  return {
    eventId: event.id,
    eventName: event.name,
    matchesPlayed,
    participantCount: participants.length,
    teamCount,
    reused: true,
  };
}

/** 新規リハーサル — 32 名を登録してブラケット生成 */
export async function createFreshRehearsal(
  onProgress: (p: RehearsalProgress) => void,
  matchCount = 0,
): Promise<RehearsalResult> {
  onProgress({ step: 'リハーサルイベント作成' });
  const event = await createRehearsalEvent();

  const participantIds: string[] = [];
  const nameById = new Map<string, string>();

  for (let i = 0; i < DUMMY_PARTICIPANTS.length; i++) {
    const spec = DUMMY_PARTICIPANTS[i];
    onProgress({
      step: `参加者登録 (${i + 1}/${REHEARSAL_PARTICIPANT_COUNT})`,
      detail: `${spec.name} ← ${spec.imageFile}.png`,
    });
    const blob = await loadRehearsalFaceBlob(spec.imageFile);
    const id = await addParticipant(event.id, spec.name, spec.rating, blob, blob);
    participantIds.push(id);
    nameById.set(id, spec.name);
  }

  onProgress({ step: '抽選・ブラケット生成（16 チーム）' });
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

  onProgress({
    step: '完了',
    detail: `${REHEARSAL_PARTICIPANT_COUNT} 名 / ${teams.length} チーム · ${matchesPlayed} 試合確定`,
  });

  return {
    eventId: event.id,
    eventName: event.name,
    matchesPlayed,
    participantCount: REHEARSAL_PARTICIPANT_COUNT,
    teamCount: teams.length,
    reused: false,
  };
}

/** Admin から — 試合だけ最初から（参加者・写真は維持） */
export async function resetRehearsalMatches(eventId: string): Promise<void> {
  await rebuildBracketFromParticipants(eventId, () => {});
}
