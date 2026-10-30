// Local-only browser checks. Creates a fresh run, never selects a published event.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');
if (!process.env.PLAYWRIGHT_MODULE) throw Error('Set PLAYWRIGHT_MODULE to an existing Playwright module (see README).');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const root = `http://localhost:${process.env.PORT ?? 5174}`;
const output = '.wrangler/local-entry';
const secrets = parseEnv(fs.readFileSync('cloudflare/local/.dev.vars', 'utf8'));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const report = { root, startedAt: new Date().toISOString(), errors: [], failures: [], externalRequests: [], checks: [] };
  const check = name => report.checks.push(name);
  try {
    context.on('request', req => { if (!req.url().startsWith(root + '/') && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) report.externalRequests.push(req.url()); });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    assert.equal((await context.request.get(root + '/api/session')).status(), 401);
    assert.equal((await context.request.get(root + '/.dev.vars')).status(), 404);
    for (const route of ['/admin', '/display', '/checkin']) {
      await page.goto(root + route);
      await page.getByRole('heading', { name: '確認コードを入力' }).waitFor();
    }
    check('direct routes render login without Supabase');
    await page.getByLabel('確認コード', { exact: true }).fill('incorrect-local-code');
    await page.getByRole('button', { name: '確認して開く' }).click();
    await page.getByRole('alert').filter({ hasText: '一致しません' }).waitFor();
    await page.getByLabel('確認コード', { exact: true }).fill(secrets.REHEARSAL_ACCESS_CODE);
    await page.getByRole('button', { name: '確認して開く' }).click();
    await page.getByRole('heading', { name: '確認する大会を選んでください' }).waitFor();
    await page.screenshot({ path: output + '/01-select-event.png', fullPage: true });
    assert.equal((await context.request.get(root + '/api/session')).status(), 200);
    const cookie = (await context.cookies()).find(value => value.name === '__Host-tournament-checkin');
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
    check('real form login, invalid code rejection, secure HttpOnly session cookie');
    const denied = await context.request.post(root + '/api/rehearsal/create', { headers: { Origin: 'https://invalid.example' }, data: { requestId: randomUUID() } });
    assert.equal(denied.status(), 403);
    check('cross-origin mutation rejected');
    const created = await context.request.post(root + '/api/rehearsal/create', { headers: { Origin: root }, data: { requestId: randomUUID() } });
    assert.equal(created.status(), 200);
    report.run = (await created.json()).eventId;
    assert.match(report.run, /^cf-through-/);
    await page.goto(root + '/checkin?run=' + report.run);
    await page.getByRole('heading', { name: '参加者受付', exact: true }).waitFor();
    // A generated bitmap exercises the real upload/crop/form path, without real personal data.
    const bitmap = async color => Buffer.from((await page.evaluate(color => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
      const c = canvas.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 96, 96);
      return canvas.toDataURL('image/png').split(',')[1];
    }, color)), 'base64');
    let loggingOut = false;
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (loggingOut && path === '/api/session' && response.status() === 401) return;
      if (response.status() >= 400) report.failures.push({ status: response.status(), path });
    });
    await page.getByLabel('名前', { exact: false }).fill('ローカル受付検証');
    await page.getByLabel('rating', { exact: false }).fill('8.5');
    await page.locator('input[type=file]').setInputFiles({ name: 'local-test.png', mimeType: 'image/png', buffer: await bitmap('#14b8a6') });
    await page.getByRole('button', { name: '参加者を登録', exact: true }).click();
    await page.locator('.participant h2', { hasText: 'ローカル受付検証' }).waitFor();
    let result = await (await context.request.get(root + '/api/participants?run=' + report.run)).json();
    assert.equal(result.participants.length, 1);
    const id = result.participants[0].id;
    const initialVersion = result.participants[0].version;
    report.participantId = id;
    await page.reload();
    await page.locator(`[data-participant-id="${id}"]`).waitFor();
    await page.getByRole('button', { name: '編集', exact: true }).click();
    await page.getByRole('heading', { name: '参加者を編集', exact: true }).waitFor();
    await page.getByLabel('名前', { exact: false }).fill('ローカル受付編集済み');
    await page.locator('input[type=file]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: await bitmap('#f97316') });
    await page.getByRole('button', { name: '変更を保存', exact: true }).click();
    await page.locator('.participant h2', { hasText: 'ローカル受付編集済み' }).waitFor();
    result = await (await context.request.get(root + '/api/participants?run=' + report.run)).json();
    assert.equal(result.participants.length, 1);
    assert.equal(result.participants[0].id, id);
    assert.equal(result.participants[0].name, 'ローカル受付編集済み');
    assert.equal(result.participants[0].version, initialVersion + 1);
    const portrait = await context.request.get(root + result.participants[0].portraitUrl);
    assert.equal(portrait.status(), 200);
    assert.equal(portrait.headers()['content-type'], 'image/jpeg');
    assert.ok((await portrait.body()).length > 100);
    await page.screenshot({ path: output + '/02-registration-edit.png', fullPage: true });
    check('real registration form, crop upload, edit and photo replacement, reload, stable participant ID');
    const other = await browser.newContext();
    assert.equal((await other.request.get(root + result.participants[0].portraitUrl)).status(), 401);
    const login = await other.request.post(root + '/api/session', { headers: { Origin: root }, data: { code: secrets.REHEARSAL_ACCESS_CODE } });
    assert.equal(login.status(), 200);
    assert.equal((await other.request.get(root + result.participants[0].portraitUrl)).status(), 200);
    const display = await other.newPage();
    await display.goto(root + '/display?run=' + report.run);
    await display.getByRole('heading', { name: '大会開始待機', exact: true }).waitFor();
    await display.screenshot({ path: output + '/03-display-waiting.png' });
    check('second browser session sees the same run; private portrait requires authentication');
    await other.close();
    loggingOut = true;
    await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
    await page.getByRole('heading', { name: '確認コードを入力' }).waitFor();
    assert.equal((await context.request.get(root + '/api/session')).status(), 401);
    check('logout clears session');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failures, []); assert.deepEqual(report.externalRequests, []);
    report.complete = true;
  } catch (error) {
    report.error = error.message; process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(output + '/result.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    await browser.close();
  }
})();
