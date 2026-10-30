// Read-only across all application screens. Never creates participant/test data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = process.argv[2] || 'https://tournament-checkin-rehearsal.pine-shaken.workers.dev';
const output = process.argv[3] || '.wrangler/participant-e2e/public';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const secrets = JSON.parse(fs.readFileSync('cloudflare/checkin/.secrets.local', 'utf8'));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const errors = [], failures = [], participantWrites = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !(response.status() === 401 && new URL(response.url()).pathname === '/api/session')) failures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() !== 'GET' && url.pathname.includes('/participants')) participantWrites.push(url.pathname);
      assert.equal(request.headers().authorization, undefined);
    });
    await page.goto(root + '/display');
    await page.getByLabel('確認コード', { exact: true }).fill(secrets.REHEARSAL_ACCESS_CODE);
    await page.getByRole('button', { name: '確認して開く', exact: true }).click();
    await page.getByRole('heading', { name: '参加者確認', exact: true }).waitFor();
    const headers = { Cookie: (await context.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join('; ') };
    const listResponse = await context.request.get(root + '/api/participants', { headers });
    assert.equal(listResponse.status(), 200);
    const list = await listResponse.json();
    for (const url of await page.locator('script[src]').evaluateAll(elements => elements.map(element => element.src))) {
      const source = await (await context.request.get(url)).text();
      for (const secret of Object.values(secrets)) assert.equal(source.includes(secret), false);
      assert.equal(/ADMIN_API_TOKEN|DISPLAY_API_TOKEN|supabase\.co/.test(source), false);
    }
    assert.ok(list.participants.every(participant => participant.portraitSource === 'uploaded'));
    const participant = (process.env.VERIFY_PARTICIPANT_NAME ? list.participants.find(participant => participant.name === process.env.VERIFY_PARTICIPANT_NAME) : list.participants[0]);
    if (!participant) {
      assert.equal(list.participants.length, 0, 'Specified participant was not found among registered users');
      await page.getByRole('heading', { name: '写真付き参加者の登録を待っています', exact: true }).waitFor();
      assert.equal(await page.locator('.participant img').count(), 0);
      for (const screen of ['/admin', '/show-preview']) {
        await page.goto(root + screen);
        await page.getByRole('heading', { name: '写真付き参加者の登録を待っています', exact: true }).waitFor();
        assert.equal(await page.locator('.pm-stage').count(), 0);
      }
      const report = { root, checkedAt: new Date().toISOString(), complete: false, status: 'waiting-for-real-registration', normalParticipants: 0, excludedTestParticipants: list.excludedTestParticipants, secretsAbsentFromBundle: true, noFixtureFallback: true, participantWrites: 0, jsErrors: errors };
      assert.deepEqual(errors, []); assert.deepEqual(failures, []);
      fs.writeFileSync(output + '/result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); return;
    }
    const image = page.locator(`img[src^="${participant.portraitUrl}"]`);
    await image.waitFor(); await image.evaluate(img => img.decode());
    await page.getByRole('heading', { name: participant.name, exact: true }).waitFor();
    await page.screenshot({ path: output + '/display.png', fullPage: true });
    const portrait = await context.request.get(root + participant.portraitUrl, { headers });
    assert.equal(portrait.status(), 200);
    const bytes = await portrait.body(); assert.ok(bytes.length > 0);
    assert.match(portrait.headers()['content-type'], /^image\/(jpeg|png|webp)/);
    assert.equal(Number(portrait.headers()['content-length']), bytes.length);
    assert.equal(portrait.headers()['cache-control'], 'no-store');
    await page.goto(root + '/admin');
    await page.getByRole('heading', { name: '大会運営・参加者確認', exact: true }).waitFor();
    await page.getByRole('heading', { name: participant.name, exact: true }).waitFor();
    await page.locator(`img[src^="${participant.portraitUrl}"]`).evaluate(img => img.decode());
    await page.screenshot({ path: output + '/admin.png', fullPage: true });
    const scenes = list.participants.length > 1 ? ['draw','result','bracket','vs','next','champion'] : ['draw','result','bracket','champion'];
    const sceneEvidence = [];
    for (const scene of scenes) {
      await page.goto(`${root}/show-preview?participant=${participant.id}&scene=${scene}`);
      await page.getByRole('heading', { name: '登録写真で演出確認', exact: true }).waitFor();
      await page.getByRole('button', { name: 'スキップ', exact: true }).click();
      const stage = page.locator('.pm-stage');
      await stage.locator(`img[src^="${participant.portraitUrl}"]`).first().evaluate(img => img.decode());
      assert.ok((await stage.textContent()).includes(participant.name));
      const portraitRequests = await stage.locator('img').evaluateAll(images => images.map(img => img.getAttribute('src')).filter(src => src.startsWith('/api/')));
      assert.ok(portraitRequests.some(url => new URL(url, root).pathname === participant.portraitUrl));
      assert.equal(await stage.locator('img[src^="data:"],img[src^="blob:"],img[src*="test01"]').count(), 0);
      sceneEvidence.push({ scene, participantId: participant.id, portraitUrl: participant.portraitUrl });
      await page.screenshot({ path: `${output}/scene-${scene}.png`, fullPage: true });
    }
    // Browser-side load failure must show an error, never a sample face.
    await page.route(`**${participant.portraitUrl}*`, route => route.fulfill({ status: 404, body: '' }));
    await page.getByRole('button', { name: '参加者を更新', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '写真を取得できませんでした' }).waitFor();
    await page.unroute(`**${participant.portraitUrl}*`);
    await page.getByRole('button', { name: '参加者を更新', exact: true }).click();
    await page.locator(`.pm-stage img[src^="${participant.portraitUrl}"]`).first().evaluate(img => img.decode());
    // Simulate expiry only in this browser, then verify the existing real photo reloads after login.
    const participantRoute = url => url.pathname === '/api/participants';
    await page.route(participantRoute, route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"UNAUTHORIZED"}' }));
    await page.getByRole('button', { name: '参加者を更新', exact: true }).click();
    await page.getByRole('heading', { name: '確認コードを入力', exact: true }).waitFor();
    await page.unroute(participantRoute);
    await page.getByLabel('確認コード', { exact: true }).fill(secrets.REHEARSAL_ACCESS_CODE);
    await page.getByRole('button', { name: '確認して開く', exact: true }).click();
    await page.getByRole('heading', { name: '登録写真で演出確認', exact: true }).waitFor();
    await page.locator(`.pm-stage img[src^="${participant.portraitUrl}"]`).first().evaluate(img => img.decode());
    assert.deepEqual(errors, []); assert.deepEqual(participantWrites, []);
    assert.ok(failures.every(failure => (failure.status === 404 && failure.path === participant.portraitUrl) || (failure.status === 401 && failure.path === '/api/participants')));
    const report = { root, checkedAt: new Date().toISOString(), dataFlowVerified: true, physicalCameraOperationVerified: false, note: 'Read-only verification of existing uploaded participant; physical camera operation must be confirmed separately.', participantId: participant.id, name: participant.name, participantsApiStatus: listResponse.status(), portrait: { url: participant.portraitUrl, status: portrait.status(), contentType: portrait.headers()['content-type'], contentLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }, scenes: sceneEvidence, samePortraitInDisplayAdminAndScenes: true, participantWrites: 0, noFixtureFallback: true, jsErrors: errors };
    fs.writeFileSync(output + '/result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
