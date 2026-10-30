const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const root = process.argv[2] || 'http://127.0.0.1:8788';
const output = process.argv[3] || 'docs/checkin-verification/local';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(root).hostname) && process.env.ALLOW_PUBLIC_TEST_REGISTRATION !== '1') {
  throw new Error('Public fake-camera registration is disabled. Use read-only photo checks, or explicitly set ALLOW_PUBLIC_TEST_REGISTRATION=1 to create synthetic test data.');
}
const secrets = JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local', 'utf8'));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errors = [], external = [], failures = [];
  try {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
    const monitor = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await mobile.newPage(), display = await monitor.newPage();
    // APIRequestContext does not send Secure cookies over local HTTP; the browser
    // itself treats loopback as trustworthy. Preserve each context's own cookie.
    async function headers(context, extra = {}) {
      return { Cookie: (await context.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join('; '), ...extra };
    }
    for (const current of [page, display]) {
      current.on('pageerror', e => errors.push(e.message));
      current.on('request', r => {
        if (!r.url().startsWith('data:') && !r.url().startsWith('blob:') && new URL(r.url()).origin !== new URL(root).origin) external.push(r.url());
        assert.equal(r.headers().authorization, undefined);
      });
      current.on('response', r => { if (r.status() >= 400 && !(r.status() === 401 && new URL(r.url()).pathname === '/api/session')) failures.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    }
    async function login(current, path) {
      await current.goto(root + path);
      await current.getByRole('heading', { name: '確認コードを入力' }).waitFor();
      await current.getByLabel('確認コード', { exact: true }).fill(secrets.REHEARSAL_ACCESS_CODE);
      await current.getByRole('button', { name: '確認して開く', exact: true }).click();
    }
    await login(display, '/display');
    await display.getByRole('heading', { name: '参加者確認', exact: true }).waitFor();
    const beforeResponse = await monitor.request.get(root + '/api/participants', { headers: await headers(monitor) });
    assert.equal(beforeResponse.status(), 200);
    const before = await beforeResponse.json();
    await login(page, '/checkin');
    await page.getByRole('heading', { name: '参加者受付', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const name = `受付検証 ${new Date().toISOString().slice(0,10)} ${crypto.randomBytes(3).toString('hex')}`;
    await page.getByRole('textbox', { name: /名前/ }).fill(name);
    await page.getByRole('button', { name: 'カメラを起動', exact: true }).click();
    await page.getByRole('button', { name: '写真を撮影', exact: true }).click();
    await page.getByRole('img', { name: '登録前の撮影写真', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/checkin-photo.png`, fullPage: true });
    const registrationRequest = page.waitForRequest(r => new URL(r.url()).pathname === '/api/participants' && r.method() === 'POST');
    await page.getByRole('button', { name: '参加者を登録', exact: true }).click();
    const submitted = JSON.parse((await registrationRequest).postData());
    await page.getByRole('heading', { name, exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('img', { name: `${name}の顔写真`, exact: true }).waitFor();
    await page.screenshot({ path: `${output}/checkin-success.png`, fullPage: true });
    // Display uses its own session. Wait for polling; do not copy the mobile cookie.
    await display.getByRole('heading', { name, exact: true }).waitFor({ timeout: 15000 });
    const img = display.getByRole('img', { name: `${name}の顔写真`, exact: true });
    await img.waitFor();
    await img.evaluate(image => image.decode());
    assert.ok(await img.evaluate(image => image.naturalWidth === 480 && image.naturalHeight === 480));
    await display.screenshot({ path: `${output}/display-1920.png`, fullPage: true });
    const after = await (await monitor.request.get(root + '/api/participants', { headers: await headers(monitor) })).json();
    const saved = after.participants.find(p => p.name === name);
    assert.ok(saved);
    assert.equal(after.participants.length, before.participants.length + 1);
    const actualPhoto = await monitor.request.get(root + saved.photoUrl, { headers: await headers(monitor) });
    assert.equal(actualPhoto.status(), 200);
    assert.deepEqual(await actualPhoto.body(), Buffer.from(submitted.photo.split(',')[1], 'base64'));
    const retry = await mobile.request.post(root + '/api/participants', { data: submitted, headers: await headers(mobile, { Origin: root }) });
    assert.equal(retry.status(), 200);
    assert.equal((await retry.json()).replayed, true);
    const replayList = await (await monitor.request.get(root + '/api/participants', { headers: await headers(monitor) })).json();
    assert.equal(replayList.participants.length, after.participants.length);
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.get(root + saved.photoUrl)).status(), 401);
    assert.equal((await anonymous.request.get(root + '/api/participants')).status(), 401);
    const invalid = await mobile.request.post(root + '/api/participants', { data: { ...submitted, name: '' }, headers: await headers(mobile, { Origin: root }) });
    assert.equal(invalid.status(), 400);
    const crossSite = await mobile.request.post(root + '/api/participants', { data: submitted, headers: await headers(mobile, { Origin: 'https://example.invalid' }) });
    assert.equal(crossSite.status(), 403);
    const sessionCookie = (await mobile.cookies()).find(cookie => cookie.name === '__Host-tournament-checkin');
    assert.ok(sessionCookie?.httpOnly && sessionCookie.secure && sessionCookie.sameSite === 'Strict');
    assert.equal(await page.evaluate(() => document.cookie), '');
    const assets = await page.locator('script[src]').evaluateAll(elements => elements.map(e => e.src));
    for (const url of assets) {
      const source = await (await mobile.request.get(url)).text();
      for (const secret of Object.values(secrets)) assert.equal(source.includes(secret), false);
      assert.equal(/ADMIN_API_TOKEN|DISPLAY_API_TOKEN|supabase\.co/.test(source), false);
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failures, []);
    const report = { root, participantId: saved.id, participantName: name, photoUrl: saved.photoUrl, photoDimensions: [480,480], newParticipants: 1, independentDisplaySession: true, displayPolling: true, photoByteMatch: true, duplicateRetryPrevented: true, anonymousPhotoStatus: 401, crossOriginWriteStatus: 403, secretsAbsentFromBundle: true, jsErrors: errors, externalRequests: external, failedResponses: failures, camera: 'Chromium simulated camera; not a physical smartphone' };
    fs.writeFileSync(`${output}/result.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
