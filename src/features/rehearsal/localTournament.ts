import { buildDoubleElimination, createManagerFromSnapshot, exportSnapshot, toStageData, type BracketSnapshot } from '../bracket/manager';
import { applyResult, getChampionTeamId, getNextMatch, getSlotTeamUuid } from '../progression/progression';
import { makeBalancedTeams } from '../draw/draw';
import { DUMMY_PARTICIPANTS } from './dummyData';

export interface LocalPlayer { id: string; name: string; rating: number; face: string }
export interface LocalTeam { id: string; members: LocalPlayer[] }
export interface LocalTournament {
  schema: 1;
  players: LocalPlayer[];
  teams: LocalTeam[];
  snapshot: BracketSnapshot | null;
  phase: 'entry' | 'draw' | 'next' | 'live' | 'result' | 'finished';
  winner: string | null;
  champion: string | null;
  undo: BracketSnapshot | null;
}
export const LOCAL_REHEARSAL_KEY = 'tournament.local-rehearsal.v1';
export function emptyLocalTournament(): LocalTournament {
  return { schema: 1, players: [], teams: [], snapshot: null, phase: 'entry', winner: null, champion: null, undo: null };
}
export function samplePlayers(count: 8 | 16 | 32): LocalPlayer[] {
  return DUMMY_PARTICIPANTS.slice(0, count).map((p, i) => ({ id: `local-${i}`, name: p.name, rating: p.rating, face: `/images/${p.imageFile}.png` }));
}
export async function drawLocalTournament(state: LocalTournament): Promise<LocalTournament> {
  if (state.players.length < 4) throw new Error('ダブルスは4名以上登録してください');
  const teams = makeBalancedTeams(state.players, 'trio').map((ids, i) => ({ id: `local-team-${i}`, members: ids.map(id => state.players.find(p => p.id === id)!) }));
  const snapshot = await buildDoubleElimination(teams.map(t => t.id));
  return { ...state, teams, snapshot, phase: 'draw', winner: null, champion: null, undo: null };
}
export function currentLocalTeams(state: LocalTournament): LocalTeam[] {
  if (!state.snapshot) return [];
  const data = toStageData(state.snapshot);
  const match = getNextMatch(data);
  if (!match) return [];
  return ([0, 1] as const).map(slot => state.teams.find(t => t.id === getSlotTeamUuid(data, match, slot))).filter((t): t is LocalTeam => Boolean(t));
}
export async function confirmLocalResult(state: LocalTournament, slot: 0 | 1): Promise<LocalTournament> {
  if (!state.snapshot || state.phase !== 'live') throw new Error('先に試合開始を押してください');
  const data = toStageData(state.snapshot);
  const match = getNextMatch(data);
  if (!match) throw new Error('進行できる試合がありません');
  const manager = createManagerFromSnapshot(structuredClone(state.snapshot));
  await applyResult(manager, data, match.id, slot, match.id);
  const snapshot = await exportSnapshot(manager);
  const champion = await getChampionTeamId(manager);
  return { ...state, snapshot, undo: state.snapshot, winner: getSlotTeamUuid(data, match, slot), champion, phase: champion ? 'finished' : 'result' };
}
export function undoLocalResult(state: LocalTournament): LocalTournament {
  if (!state.undo) throw new Error('戻せる結果がありません');
  return { ...state, snapshot: state.undo, undo: null, winner: null, champion: null, phase: 'next' };
}
