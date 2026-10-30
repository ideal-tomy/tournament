// Read-only recovery/check of the prepared public showcase; never scores or starts a match.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
(async () => {
  const root = 'https://tournament-through-rehearsal.pine-shaken.workers.dev';
  const dir = '.wrangler/match-transition-e2e';
  const prior = JSON.parse(fs.readFileSync(dir + '/progress.json', 'utf8'));
  const secret = JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local', 'utf8'));
  const host = new URL(root).hostname;
  const ip = await new Promise((resolve, reject) => require('node:dns').lookup(host, { family: 4 }, (e, a) => e ? reject(e) : resolve(a)));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--disable-quic', `--host-resolver-rules=MAP ${host} ${ip}`] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(root + '/match-transition?run=' + prior.eventId);
    assert.equal(await page.evaluate(async code => (await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })).status, secret.REHEARSAL_ACCESS_CODE), 200);
    await page.reload();
    const state = () => page.evaluate(async () => { const r = await fetch('/api/draw/state' + location.search); if (!r.ok) throw Error('state status ' + r.status); return r.json(); });
    const initial = await state();
    assert.equal(initial.scene, 'vs_card');
    const writes = [], errors = [];
    page.on('request', r => { if (r.method() === 'POST') writes.push(new URL(r.url()).pathname); });
    page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('button', { name: '最初から再生', exact: true }).click();
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    const status = page.getByRole('status').filter({ hasText: '読み取り専用再生' });
    const paused = await status.textContent();
    await page.waitForTimeout(800);
    assert.equal(await status.textContent(), paused);
    await page.getByRole('button', { name: '再開', exact: true }).click();
    const end = Date.now() + 25000;
    while (!(await status.textContent()).includes('NEXT MATCH・試合開始待ち') && Date.now() < end) await page.waitForTimeout(100);
    assert.ok((await status.textContent()).includes('NEXT MATCH・試合開始待ち'));
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    const final = await state();
    assert.equal(final.version, initial.version);
    assert.equal(final.scene, 'vs_card');
    await page.screenshot({ path: dir + '/showcase-replay.png', fullPage: true });
    const report = { eventId: prior.eventId, url: page.url(), scene: final.scene, version: final.version, currentMatch: final.flow.currentMatch.id, replayReadOnly: true, pauseResume: true, writes, errors, priorLiveChecks: { winner: prior.winnerVisible, before: prior.beforeVisible, line: prior.lineMoving, after: prior.afterVisible, next: prior.nextVisible, realDestination: prior.realDestinationVerified, hold: prior.startHold, reload: prior.reloadStable } };
    fs.writeFileSync(dir + '/showcase.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.name + ': ' + e.message.split('Call log:')[0]); process.exitCode = 1; });
