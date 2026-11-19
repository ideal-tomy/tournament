// API-only: prepare 40-team progression, autoplay partial goal (20 matches) like RehearsalPage.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');

const root = `http://127.0.0.1:${process.env.PORT ?? 5174}`;
const secrets = parseEnv(fs.readFileSync('cloudflare/local/.dev.vars', 'utf8'));
const PARTIAL_GOAL = Number(process.env.PARTIAL_MATCH_GOAL ?? 20);
const TEAMS = Number(process.env.PROGRESSION_TEAMS ?? 4); // fast default; set 40 for full scale
const COURTS = Number(process.env.PROGRESSION_COURTS ?? 2);

let cookie = '';

async function call(path, { method = 'GET', body, run } = {}) {
  const url = run ? `${root}${path}${path.includes('?') ? '&' : '?'}run=${encodeURIComponent(run)}` : `${root}${path}`;
  const headers = { Origin: root, Cookie: cookie };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(url, { method, headers, body });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function login() {
  const result = await call('/api/session', { method: 'POST', body: { code: secrets.REHEARSAL_ACCESS_CODE } });
  assert.equal(result.status, 200);
  cookie = (await fetch(`${root}/api/session`, { method: 'POST', headers: { Origin: root, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: secrets.REHEARSAL_ACCESS_CODE }) })).headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.ok(cookie);
}

async function status(run) {
  const result = await call('/api/rehearsal/status', { run });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  return result.json;
}

async function prepare() {
  const prepared = await call('/api/rehearsal/prepare-progression', {
    method: 'POST',
    body: {
      requestId: randomUUID(),
      format: 'double_elimination',
      title: `${TEAMS}チーム・自動進行確認`,
      teams: TEAMS,
      courts: COURTS,
    },
  });
  assert.equal(prepared.status, 200, JSON.stringify(prepared.json));
  assert.equal(prepared.json.timingPreset, 'instant');
  assert.equal(prepared.json.scene, 'interval');
  return prepared.json.eventId;
}

async function portraitSample(run, participants) {
  const person = participants[0];
  const url = `${root}${person.portraitUrl}?run=${encodeURIComponent(run)}&version=${person.version}`;
  const response = await fetch(url, { headers: { Origin: root, Cookie: cookie } });
  assert.equal(response.status, 200, `${person.name} portrait`);
}

async function nextCommand(state) {
  const body = { requestId: randomUUID(), expectedVersion: state.version };
  if (state.checkinStatus === 'open') return { path: '/api/checkin/close', body: { requestId: randomUUID(), expectedRevision: state.checkinRevision } };
  if (!state.session) return { path: '/api/draw/pairs', body: { ...body, mode: 'auto' } };
  if (state.scene === 'idle') return { path: '/api/draw/start', body };
  if (state.scene === 'interval' && state.flow?.courts) {
    const boards = state.flow.courts.boards;
    const call = boards.find(b => b.stage === 'call' && b.matchId != null);
    if (call) return { path: '/api/tournament/court-start', body: { ...body, board: call.board } };
    const live = boards.find(b => b.stage === 'live');
    if (live) return { path: '/api/tournament/court-winner', body: { ...body, board: live.board, winnerSlot: 0 } };
    const result = boards.find(b => b.stage === 'result');
    if (result) return { path: '/api/tournament/court-next', body: { ...body, board: result.board } };
    const idle = boards.find(b => b.stage === 'idle' && b.matchId == null);
    if (idle) return { path: '/api/tournament/court-next', body: { ...body, board: idle.board } };
    return null;
  }
  if (state.flow?.canAdvance) return { path: '/api/tournament/advance', body };
  if (state.flow?.canGameStart) return { path: '/api/tournament/game-start', body };
  if (state.flow?.canStart) return { path: '/api/tournament/start', body };
  if (state.scene === 'match_live') return { path: '/api/tournament/winner', body: { ...body, winnerSlot: 0 } };
  return null;
}

(async () => {
  await login();
  const run = await prepare();
  let s = await status(run);
  await portraitSample(run, s.participants);
  assert.ok(s.integrity?.consistent);
  let guard = 0;
  while (guard++ < 2000) {
    const completed = s.flow?.completedMatches ?? 0;
    if (completed >= PARTIAL_GOAL) {
      console.log(`部分自動 OK: ${completed} 試合 / run=${run}`);
      console.log(`  rehearsal: ${root}/rehearsal?run=${run}`);
      process.exit(0);
    }
    if (s.scene === 'finished') throw new Error('大会終了に達しましたが部分目標に届きませんでした');
    const command = await nextCommand(s);
    if (!command) {
      await new Promise(r => setTimeout(r, 50));
      s = await status(run);
      continue;
    }
    const posted = await call(command.path, { method: 'POST', body: command.body, run });
    if (posted.status !== 200) {
      if (command.path === '/api/tournament/advance' && posted.json?.error === 'VERSION_CONFLICT') {
        s = await status(run);
        continue;
      }
      throw new Error(`${command.path} ${posted.status} ${JSON.stringify(posted.json)}`);
    }
    s = await status(run);
  }
  throw new Error('autoplay guard exceeded');
})().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});