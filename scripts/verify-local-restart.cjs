// Run after stopping and restarting the local server; reads prior verification artifacts.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const root = `http://localhost:${process.env.PORT ?? 5174}`;
const output = '.wrangler/local-restart';
const prior = JSON.parse(fs.readFileSync('.wrangler/local-e2e/progress.json', 'utf8'));
const entry = JSON.parse(fs.readFileSync('.wrangler/local-entry/result.json', 'utf8'));
const secrets = parseEnv(fs.readFileSync('cloudflare/local/.dev.vars', 'utf8'));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const report = { root, startedAt: new Date().toISOString(), errors: [] };
  try {
    assert.match(prior.eventId, /^cf-through-/); assert.match(entry.run, /^cf-through-/);
    assert.equal((await context.request.post(root + '/api/session', { headers: { Origin: root }, data: { code: secrets.REHEARSAL_ACCESS_CODE } })).status(), 200);
    const state = await (await context.request.get(root + '/api/rehearsal/status?run=' + prior.eventId)).json();
    assert.equal(state.scene, 'finished'); assert.equal(state.integrity.consistent, true);
    assert.equal(state.participants.length, 8); assert.equal(state.teams.length, 4);
    assert.ok(state.flow.championTeamId); assert.ok(state.flow.completedMatches >= 6);
    const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(root + '/display?run=' + prior.eventId);
    await page.locator('[data-draw-scene="finished"]').waitFor();
    await page.screenshot({ path: output + '/champion-after-restart.png' });
    await page.reload(); await page.locator('[data-draw-scene="finished"]').waitFor();
    const after = await (await context.request.get(root + '/api/rehearsal/status?run=' + prior.eventId)).json();
    assert.equal(after.version, state.version); assert.equal(after.flow.championTeamId, state.flow.championTeamId);
    const participants = await (await context.request.get(root + '/api/participants?run=' + entry.run)).json();
    assert.equal(participants.participants.length, 1);
    const person = participants.participants[0]; assert.equal(person.id, entry.participantId);
    assert.equal(person.name, 'ローカル受付編集済み');
    const portrait = await context.request.get(root + person.portraitUrl);
    assert.equal(portrait.status(), 200); assert.ok((await portrait.body()).length > 100);
    Object.assign(report, { complete: true, finishedRun: prior.eventId, version: state.version, matches: state.flow.completedMatches, champion: state.flow.championTeamId, photoRun: entry.run, d1Restored: true, r2Restored: true });
    assert.deepEqual(report.errors, []);
  } catch (error) { report.error = error.message; process.exitCode = 1; }
  finally { fs.writeFileSync(output + '/result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); }
})();
