import { generatedTeamName, VENUE_TEAM_NAME_MAX } from '../../../src/features/draw/teamName';
import { ClientError, hash, readBody, requestId, response, type CheckinEnv, type Statement } from './domain';

export interface EntryTeam { id: string; name: string; memberIds: string[] }

const memberId = /^checkin-[a-f0-9-]{36}$/;

export function normalizeTeamName(value: string) {
  const name = value.trim().normalize('NFKC').replace(/\s+/g, ' ');
  if ([...name].length > VENUE_TEAM_NAME_MAX) throw new ClientError('TEAM_NAME_TOO_LONG', 400);
  return name;
}

export async function listEntryTeams(env: CheckinEnv): Promise<EntryTeam[]> {
  const rows = await env.DB.prepare(`SELECT t.id, t.name, m.participant_id
    FROM entry_teams t JOIN entry_team_members m ON m.team_id = t.id
    WHERE t.event_id = ? ORDER BY t.position, t.id, m.position`).bind(env.CHECKIN_EVENT_ID).all<{ id: string; name: string; participant_id: string }>();
  const teams: EntryTeam[] = [];
  for (const row of rows.results) {
    const current = teams.at(-1);
    if (current?.id === row.id) current.memberIds.push(row.participant_id);
    else teams.push({ id: row.id, name: row.name, memberIds: [row.participant_id] });
  }
  return teams;
}

export async function entryTeamsLocked(env: CheckinEnv) {
  return !!(await env.DB.prepare('SELECT 1 AS locked FROM draw_sessions WHERE event_id = ? AND committed_at IS NOT NULL LIMIT 1').bind(env.CHECKIN_EVENT_ID).first());
}

/** Keep a custom label only when it differs from the member names. */
export function storedTeamName(custom: string, memberNames: string[]) {
  return !custom || custom === generatedTeamName(memberNames) ? '' : custom;
}

export async function preservedNames(env: CheckinEnv, pairs: string[][], provided: unknown, namesById: Map<string, string>) {
  const existing = new Map((await listEntryTeams(env)).map(team => [[...team.memberIds].sort().join(), team.name]));
  const supplied = provided === undefined ? null : suppliedNames(provided, pairs.length);
  return pairs.map((pair, index) => storedTeamName(supplied ? supplied[index] : existing.get([...pair].sort().join()) ?? '', pair.map(id => namesById.get(id) ?? '')));
}

export function replaceEntryStatements(env: CheckinEnv, pairs: string[][], names: string[], authorized: string, request: string): Statement[] {
  const teams = pairs.map((pair, position) => ({ id: crypto.randomUUID(), eventId: env.CHECKIN_EVENT_ID, name: names[position] ?? '', position }));
  const members = pairs.flatMap((pair, index) => pair.map((participantId, position) => ({ teamId: teams[index]!.id, participantId, position: position + 1 })));
  const gate = [env.CHECKIN_EVENT_ID, request];
  return [
    env.DB.prepare(`DELETE FROM entry_teams WHERE event_id = ? AND ${authorized}`).bind(env.CHECKIN_EVENT_ID, ...gate),
    env.DB.prepare(`INSERT INTO entry_teams(id, event_id, name, position)
      SELECT json_extract(value,'$.id'), json_extract(value,'$.eventId'), json_extract(value,'$.name'), json_extract(value,'$.position')
      FROM json_each(?) WHERE ${authorized}`).bind(JSON.stringify(teams), ...gate),
    env.DB.prepare(`INSERT INTO entry_team_members(team_id, participant_id, position)
      SELECT json_extract(value,'$.teamId'), json_extract(value,'$.participantId'), json_extract(value,'$.position')
      FROM json_each(?) WHERE ${authorized}`).bind(JSON.stringify(members), ...gate),
  ];
}

function suppliedNames(value: unknown, count: number) {
  if (!Array.isArray(value) || value.length !== count || value.some(item => typeof item !== 'string')) throw new ClientError('INVALID_INPUT', 400);
  return value.map(item => normalizeTeamName(item));
}

function pairIds(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2 || value.some(id => typeof id !== 'string' || !memberId.test(id)) || value[0] === value[1]) throw new ClientError('INVALID_INPUT', 400);
  return value as [string, string];
}

async function receipt(env: CheckinEnv, id: string) {
  return env.DB.prepare('SELECT action, request_hash FROM checkin_receipts WHERE event_id = ? AND request_id = ?').bind(env.CHECKIN_EVENT_ID, id).first<{ action: string; request_hash: string }>();
}

async function command(env: CheckinEnv, action: string, hashValue: string, body: Record<string, unknown>, apply: (id: string, authorized: string, requestHash: string) => Promise<void>) {
  const id = requestId(body.requestId);
  const requestHash = await hash(hashValue);
  const prior = await receipt(env, id);
  if (prior) {
    if (prior.action !== action || prior.request_hash !== requestHash) throw new ClientError('REQUEST_CONFLICT', 409);
    return response({ saved: true, replayed: true });
  }
  const authorized = `EXISTS(SELECT 1 FROM checkin_receipts WHERE event_id = ? AND request_id = ? AND action = '${action}')`;
  await apply(id, authorized, requestHash);
  const committed = await receipt(env, id);
  if (!committed) {
    if (await entryTeamsLocked(env)) throw new ClientError('ENTRY_TEAMS_LOCKED', 409);
    throw new ClientError('NOT_FOUND', 404);
  }
  if (committed.request_hash !== requestHash) throw new ClientError('REQUEST_CONFLICT', 409);
  return response({ saved: true });
}

async function save(env: CheckinEnv, body: Record<string, unknown>) {
  const [first, second] = pairIds(body.memberIds);
  if (body.name != null && typeof body.name !== 'string') throw new ClientError('INVALID_INPUT', 400);
  const typed = body.name == null ? '' : normalizeTeamName(body.name as string);
  const people = await env.DB.prepare(`SELECT id, display_name FROM participants WHERE event_id = ? AND id IN (?, ?) AND note LIKE 'checkin-v1:%' AND status = 'entered'`).bind(env.CHECKIN_EVENT_ID, first, second).all<{ id: string; display_name: string }>();
  if (people.results.length !== 2) throw new ClientError('NOT_FOUND', 404);
  const custom = storedTeamName(typed, [first, second].map(id => people.results.find(person => person.id === id)!.display_name));
  const next = Number((await env.DB.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM entry_teams WHERE event_id = ?').bind(env.CHECKIN_EVENT_ID).first<{ next: number }>())?.next ?? 1);
  const teamId = crypto.randomUUID();
  return command(env, 'entry-save', JSON.stringify(['entry-save', [first, second], custom]), body, async (id, authorized, requestHash) => {
    const gate = [env.CHECKIN_EVENT_ID, id];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO checkin_receipts(event_id, request_id, action, participant_id, request_hash, response_json)
        SELECT ?, ?, 'entry-save', NULL, ?, ? WHERE NOT EXISTS(SELECT 1 FROM draw_sessions WHERE event_id = ? AND committed_at IS NOT NULL)`)
        .bind(env.CHECKIN_EVENT_ID, id, requestHash, JSON.stringify({ saved: true }), env.CHECKIN_EVENT_ID),
      env.DB.prepare(`DELETE FROM entry_teams WHERE event_id = ? AND id IN (SELECT team_id FROM entry_team_members WHERE participant_id = ? OR participant_id = ?) AND ${authorized}`)
        .bind(env.CHECKIN_EVENT_ID, first, second, ...gate),
      env.DB.prepare(`INSERT INTO entry_teams(id, event_id, name, position) SELECT ?, ?, ?, ? WHERE ${authorized}`).bind(teamId, env.CHECKIN_EVENT_ID, custom, next, ...gate),
      env.DB.prepare(`INSERT INTO entry_team_members(team_id, participant_id, position) SELECT ?, ?, 1 WHERE ${authorized}`).bind(teamId, first, ...gate),
      env.DB.prepare(`INSERT INTO entry_team_members(team_id, participant_id, position) SELECT ?, ?, 2 WHERE ${authorized}`).bind(teamId, second, ...gate),
    ]);
  });
}

async function rename(env: CheckinEnv, body: Record<string, unknown>) {
  if (typeof body.teamId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.teamId)) throw new ClientError('INVALID_INPUT', 400);
  if (typeof body.name !== 'string') throw new ClientError('INVALID_INPUT', 400);
  const members = await env.DB.prepare(`SELECT p.display_name FROM entry_team_members m JOIN participants p ON p.id = m.participant_id WHERE m.team_id = ? ORDER BY m.position`).bind(body.teamId).all<{ display_name: string }>();
  const name = storedTeamName(normalizeTeamName(body.name), members.results.map(member => member.display_name));
  return command(env, 'entry-rename', JSON.stringify(['entry-rename', body.teamId, name]), body, async (id, authorized, requestHash) => {
    const gate = [env.CHECKIN_EVENT_ID, id];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO checkin_receipts(event_id, request_id, action, participant_id, request_hash, response_json)
        SELECT ?, ?, 'entry-rename', NULL, ?, ? WHERE NOT EXISTS(SELECT 1 FROM draw_sessions WHERE event_id = ? AND committed_at IS NOT NULL)
        AND EXISTS(SELECT 1 FROM entry_teams WHERE id = ? AND event_id = ?)`)
        .bind(env.CHECKIN_EVENT_ID, id, requestHash, JSON.stringify({ saved: true }), env.CHECKIN_EVENT_ID, body.teamId, env.CHECKIN_EVENT_ID),
      env.DB.prepare(`UPDATE entry_teams SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND event_id = ? AND ${authorized}`)
        .bind(name, body.teamId, env.CHECKIN_EVENT_ID, ...gate),
    ]);
  });
}

async function release(env: CheckinEnv, body: Record<string, unknown>) {
  if (typeof body.teamId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.teamId)) throw new ClientError('INVALID_INPUT', 400);
  return command(env, 'entry-release', JSON.stringify(['entry-release', body.teamId]), body, async (id, authorized, requestHash) => {
    const gate = [env.CHECKIN_EVENT_ID, id];
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO checkin_receipts(event_id, request_id, action, participant_id, request_hash, response_json)
        SELECT ?, ?, 'entry-release', NULL, ?, ? WHERE NOT EXISTS(SELECT 1 FROM draw_sessions WHERE event_id = ? AND committed_at IS NOT NULL)
        AND EXISTS(SELECT 1 FROM entry_teams WHERE id = ? AND event_id = ?)`)
        .bind(env.CHECKIN_EVENT_ID, id, requestHash, JSON.stringify({ saved: true }), env.CHECKIN_EVENT_ID, body.teamId, env.CHECKIN_EVENT_ID),
      env.DB.prepare(`DELETE FROM entry_teams WHERE id = ? AND event_id = ? AND ${authorized}`).bind(body.teamId, env.CHECKIN_EVENT_ID, ...gate),
    ]);
  });
}

export async function entryTeamRoute(request: Request, env: CheckinEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== 'POST') return null;
  if (url.pathname === '/api/entry-teams') return save(env, await readBody(request, 4096));
  if (url.pathname === '/api/entry-teams/rename') return rename(env, await readBody(request, 4096));
  if (url.pathname === '/api/entry-teams/release') return release(env, await readBody(request, 4096));
  return null;
}
