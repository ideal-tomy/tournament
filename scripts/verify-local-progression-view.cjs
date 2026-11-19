// Local-only: prepare instant 8×2 progression, drive courts via API, open Display for viewing.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');

const root = `http://127.0.0.1:${process.env.PORT ?? 5174}`;
const album = 'cf-local-entry';
const output = '.wrangler/local-progression-view';
const secrets = parseEnv(fs.readFileSync('cloudflare/local/.dev.vars', 'utf8'));
const samplePhoto = (() => {
  const photoPath = 'docs/S__67444800.jpg';
  if (fs.existsSync(photoPath)) {
    return `data:image/jpeg;base64,${fs.readFileSync(photoPath).toString('base64')}`;
  }
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAADwAH//Z';
})();

let cookie = '';

async function call(path, { method = 'GET', body, run, retries = 3 } = {}) {
  const url = run ? `${root}${path}${path.includes('?') ? '&' : '?'}run=${encodeURIComponent(run)}` : `${root}${path}`;
  const headers = { Origin: root, Cookie: cookie };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch(url, { method, headers, body });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  if (response.status === 503 && attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }
    return { status: response.status, json, headers: response.headers };
  }
  throw new Error(`Failed after retries: ${method} ${path}`);
}

async function login() {
  const result = await call('/api/session', {
    method: 'POST',
    body: { code: secrets.REHEARSAL_ACCESS_CODE },
  });
  assert.equal(result.status, 200);
  cookie = result.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.ok(cookie);
}

async function state(run) {
  const result = await call('/api/draw/state', { run });
  assert.equal(result.status, 200, `draw/state ${run}`);
  return result.json;
}

async function seedAlbum() {
  for (let index = 0; index < 4; index += 1) {
    const created = await call('/api/participants', {
      method: 'POST',
      run: album,
      body: { requestId: randomUUID(), name: `ローカル写真 ${index + 1}`, rating: 7 + index, photo: samplePhoto },
    });
    if (created.status === 409 && created.json?.error === 'CHECKIN_CLOSED') {
      throw new Error('cf-local-entry の受付が終了しています。local D1 をリセットするか受付を開き直してください。');
    }
    assert.ok([200, 201].includes(created.status), `seed participant ${index}: ${created.status}`);
  }
}

async function prepare() {
  const TEAMS = Number(process.env.PROGRESSION_TEAMS ?? 40);
  const COURTS = Number(process.env.PROGRESSION_COURTS ?? 2);
  const prepared = await call('/api/rehearsal/prepare-progression', {
    method: 'POST',
    body: {
      requestId: randomUUID(),
      format: 'double_elimination',
      title: `${TEAMS}チーム・ダブルイリミ進行確認`,
      teams: TEAMS,
      courts: COURTS,
    },
  });
  assert.equal(prepared.status, 200, JSON.stringify(prepared.json));
  const { eventId, portraitSource, scene, flow } = prepared.json;
  assert.equal(scene, 'interval');
  assert.equal(flow?.courts?.count, COURTS);
  assert.equal(prepared.json.participants?.length, TEAMS * 2);
  return { eventId, portraitSource };
}

async function portraitOk(run, participants) {
  for (const person of participants) {
    const path = `${person.portraitUrl}?run=${encodeURIComponent(run)}`;
    const response = await fetch(`${root}${path}`, { headers: { Origin: root, Cookie: cookie } });
    assert.equal(response.status, 200, person.name);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length >= 64, `${person.name} photo empty`);
  }
}

async function driveCourts(run, targetCompleted = 2) {
  let guard = 0;
  while (guard++ < 80) {
    const s = await state(run);
    if (s.flow?.completedMatches >= targetCompleted) return s;
    const boards = s.flow?.courts?.boards ?? [];
    let progressed = false;
    for (const board of boards) {
      if (board.stage === 'call' && board.matchId != null) {
        const r = await call('/api/tournament/court-start', {
          method: 'POST',
          run,
          body: { requestId: randomUUID(), expectedVersion: s.version, board: board.board },
        });
        assert.equal(r.status, 200, `court-start board ${board.board} ${JSON.stringify(r.json)}`);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;
    const fresh = await state(run);
    for (const board of fresh.flow?.courts?.boards ?? []) {
      if (board.stage === 'live') {
        const r = await call('/api/tournament/court-winner', {
          method: 'POST',
          run,
          body: { requestId: randomUUID(), expectedVersion: fresh.version, board: board.board, winnerSlot: 0 },
        });
        assert.equal(r.status, 200, `court-winner board ${board.board} ${JSON.stringify(r.json)}`);
        progressed = true;
        break;
      }
    }
    if (progressed) continue;
    const after = await state(run);
    for (const board of after.flow?.courts?.boards ?? []) {
      if (board.stage === 'result' || board.stage === 'idle') {
        const r = await call('/api/tournament/court-next', {
          method: 'POST',
          run,
          body: { requestId: randomUUID(), expectedVersion: after.version, board: board.board },
        });
        if (r.status === 200) {
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) {
      const idle = after.flow?.courts?.boards?.every(b => b.stage === 'call' || b.stage === 'idle');
      if (idle && after.flow?.completedMatches < targetCompleted) {
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }
      break;
    }
  }
  const final = await state(run);
  assert.ok(final.flow?.completedMatches >= targetCompleted, `completed ${final.flow?.completedMatches}`);
  return final;
}

async function maybePlaywright(run) {
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  if (!modulePath || !fs.existsSync(modulePath)) {
    console.log('PLAYWRIGHT_MODULE not set; skip browser screenshots.');
    return;
  }
  const { chromium } = require(modulePath);
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: '__Host-tournament-checkin',
      value: cookie.split('=')[1],
      url: root,
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(root) && response.status() >= 400) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto(`${root}/display?run=${run}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${output}/display-interval.png`, fullPage: true });
  await page.goto(`${root}/admin?run=${run}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${output}/admin-courts.png`, fullPage: true });
  const photoAlert = await page.getByRole('alert').filter({ hasText: '保存写真' }).count();
  assert.equal(photoAlert, 0, errors.join('\n'));
  await browser.close();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = { root, startedAt: new Date().toISOString(), steps: [] };
  const save = () => fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  try {
    await login();
    report.steps.push('login');
    await seedAlbum();
    report.steps.push('seed-album');
    const { eventId, portraitSource } = await prepare();
    report.eventId = eventId;
    report.portraitSource = portraitSource;
    report.steps.push('prepare-progression');
    const prepared = await state(eventId);
    await portraitOk(eventId, prepared.participants);
    report.steps.push('portraits-ok');
    const driven = await driveCourts(eventId, 2);
    report.completedMatches = driven.flow?.completedMatches;
    report.scene = driven.scene;
    report.steps.push('courts-driven');
    report.urls = {
      rehearsal: `${root}/rehearsal?run=${eventId}`,
      admin: `${root}/admin?run=${eventId}`,
      display: `${root}/display?run=${eventId}`,
    };
    save();
    await maybePlaywright(eventId);
    console.log('\n進行テスト OK（見るだけでよい状態）');
    console.log(`  Display: ${report.urls.display}`);
    console.log(`  Admin:   ${report.urls.admin}`);
    console.log(`  試合完了: ${report.completedMatches} / portrait: ${report.portraitSource}`);
    console.log(`  レポート: ${output}/report.json`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    save();
    console.error(report.error);
    process.exitCode = 1;
  }
})();