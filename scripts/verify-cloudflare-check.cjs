const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseEnv } = require('node:util');

const prefix = '/__cloudflare_check/api/events/cf-rehearsal-001/state';
const fixture = { role: 'display', event: { id: 'cf-rehearsal-001', title: 'テスト用大会（模擬応答）', environment: 'rehearsal' },
  state: { scene: 'idle', scenePayload: { test: true }, sceneSeq: 2, version: 3, startedAt: null, awaitingOperator: true,
    currentMatchId: null, presentationMode: 'full', audioEnabled: false, playback: 'holding', playbackPositionMs: 0, updatedAt: '2026-10-24T12:00:00Z' } };

(async () => {
  fs.mkdirSync('docs/cloudflare-check-verification', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    const browserRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => browserRequests.push({ url: r.url(), method: r.method(), headers: r.headers() }));
    const root = 'http://127.0.0.1:5174';
    const actual = await context.request.get(root + prefix);
    const actualStatus = actual.status();
    assert.ok([200, 401].includes(actualStatus), `Unexpected live proxy status ${actualStatus}`);
    await page.goto(root + '/cloudflare-check');
    if (actualStatus === 200) {
      await page.getByRole('status').filter({ hasText: '取得成功' }).waitFor();
      await page.getByRole('heading', { name: 'Cloudflare接続確認用大会', exact: true }).waitFor();
    } else {
      await page.getByRole('alert').filter({ hasText: 'HTTP 401' }).waitFor();
    }
    await page.screenshot({ path: 'docs/cloudflare-check-verification/live.png', fullPage: true });

    // Exercise UI edge cases locally; these requests never contact Cloudflare.
    let status = 200;
    let delay = 0;
    let invalid = false;
    await page.route('**/__cloudflare_check/**', async route => {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      await route.fulfill({ status, contentType: invalid ? 'text/html' : 'application/json', body: invalid ? '<html>not JSON</html>' : JSON.stringify(status === 200 ? fixture : { error: 'UPSTREAM_READ_FAILED' }) });
    });
    await page.getByRole('button', { name: '再取得', exact: true }).click();
    await page.getByRole('heading', { name: fixture.event.title, exact: true }).waitFor();
    assert.match(await page.locator('dl').textContent(), /scene_seq2/);
    await page.screenshot({ path: 'docs/cloudflare-check-verification/mock-success.png', fullPage: true });
    for (const value of [401, 403, 404, 500, 503]) {
      status = value;
      await page.getByRole('button', { name: '再取得', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: `HTTP ${value}` }).waitFor();
      assert.equal(await page.getByRole('heading', { name: fixture.event.title, exact: true }).count(), 0);
    }
    status = 200; invalid = true;
    await page.getByRole('button', { name: '再取得', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'INVALID_STATE_RESPONSE' }).waitFor();
    invalid = false; delay = 500;
    await page.getByRole('button', { name: '再取得', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '取得しています' }).waitFor();
    await page.getByRole('heading', { name: fixture.event.title, exact: true }).waitFor();
    await page.unroute('**/__cloudflare_check/**');
    for (const [path, heading] of [['/show-preview', '連続演出プレビュー'], ['/local-rehearsal', 'ローカル・リハーサル']]) {
      await page.goto(root + path);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    }
    await page.goto(root + '/presentation');
    await page.getByText('DB更新なし', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(browserRequests.some(r => r.headers.authorization || /workers\.dev|supabase\./.test(r.url)), false);
    assert.equal(browserRequests.filter(r => r.url.includes('/__cloudflare_check/')).some(r => r.method !== 'GET'), false);
    const files = ['.env.cloudflare-check.local', 'cloudflare/.dev.vars'];
    const secrets = files.flatMap(file => fs.existsSync(file) ? Object.entries(parseEnv(fs.readFileSync(file, 'utf8'))).filter(([key]) => /TOKEN/.test(key)).map(([, value]) => value) : []).filter(value => value && value.length >= 32);
    const serializedRequests = JSON.stringify(browserRequests);
    assert.equal(secrets.some(value => serializedRequests.includes(value)), false, 'A private token appeared in browser requests');
    console.log(JSON.stringify({ liveStatus: actualStatus, errors, browserCredentialsExposed: false, uiChecks: ['loading', 'success (mock)', '401', '403', '404', '500', '503', 'invalid JSON', 'retry', 'preview route regressions'] }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
