// Read-only public verification; intentional image failure is injected in this browser only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.argv[2] || 'https://tournament-checkin-rehearsal.pine-shaken.workers.dev';
const output = '.wrangler/photo-audit';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const secrets = JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local', 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    if (process.env.PHOTO_UI_FIXTURE === '1') {
      assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
      await page.route('**/api/session', route => route.fulfill({ status: route.request().method() === 'POST' ? 200 : 401, contentType: 'application/json', body: '{}' }));
      await page.route(url => url.pathname === '/api/participants', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ excludedTestParticipants: 0, participants: [{ id: 'checkin-981ee495-ed79-44fd-a00c-6a8792e17102', name: '自動試験確認', rating: null, eventId: 'cf-rehearsal-001', portraitSource: 'automated-test', portraitContentType: 'image/jpeg', portraitUrl: '/api/events/cf-rehearsal-001/participants/checkin-981ee495-ed79-44fd-a00c-6a8792e17102/portrait', photoUrl: '/api/participants/checkin-981ee495-ed79-44fd-a00c-6a8792e17102/photo', createdAt: '2026-10-24T00:00:00Z' }] }) }));
      await page.route('**/api/events/*/participants/*/portrait*', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(output + '/original-r2.jpg') }));
    }
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/display?includeTestData=1');
    await page.getByLabel('確認コード', { exact: true }).fill(secrets.REHEARSAL_ACCESS_CODE);
    await page.getByRole('button', { name: '確認して開く', exact: true }).click();
    await page.getByRole('heading', { name: '参加者確認', exact: true }).waitFor();
    const knownTestId = 'checkin-981ee495-ed79-44fd-a00c-6a8792e17102';
    const portraitPath = `/api/events/cf-rehearsal-001/participants/${knownTestId}/portrait`;
    const image = page.locator(`img[src^="${portraitPath}"]`);
    await image.evaluate(img => img.decode());
    const display = await image.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, currentSrc: new URL(img.currentSrc).pathname, background: getComputedStyle(img).backgroundColor, filter: getComputedStyle(img).filter, objectFit: getComputedStyle(img).objectFit }));
    assert.equal(display.width, 480); assert.equal(display.height, 480);
    assert.equal(display.filter, 'none'); assert.equal(display.objectFit, 'cover');
    await page.getByText('自動試験用の画像です。緑色は模擬カメラの撮影内容で、実際の顔写真ではありません。', { exact: true }).waitFor();
    await page.screenshot({ path: output + '/display-labeled.png', fullPage: true });
    // Break only the known test image, leaving any user photos untouched.
    const pattern = `**${portraitPath}*`;
    await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"PHOTO_UNAVAILABLE"}' }));
    await page.getByRole('button', { name: '今すぐ更新', exact: true }).click();
    await page.getByText('写真を取得できませんでした。', { exact: true }).waitFor();
    await page.screenshot({ path: output + '/photo-error.png', fullPage: true });
    await page.unroute(pattern);
    if (process.env.PHOTO_UI_FIXTURE === '1') await page.route(pattern, route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(output + '/original-r2.jpg') }));
    await page.getByRole('button', { name: '写真を再読み込み', exact: true }).click();
    await image.waitFor(); await image.evaluate(img => img.decode());
    assert.equal(await page.getByText('写真を取得できませんでした。', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    const report = { origin, participantWrites: 0, checkedAt: new Date().toISOString(), display, knownTestImageLabeled: true, injectedFailureShown: true, retryRestoredImage: true, jsErrors: errors };
    fs.writeFileSync(output + '/display-result.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
