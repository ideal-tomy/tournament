const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  fs.mkdirSync('docs/local-rehearsal-check', { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, permissions: ['camera'] });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/supabase|cloudflare/.test(r.url())) external.push(r.url()); });
    page.on('dialog', dialog => dialog.accept());
    const root = 'http://127.0.0.1:5174';
    await page.goto(root + '/show-preview');
    await page.getByRole('heading', { name: '連続演出プレビュー' }).waitFor();
    await page.getByRole('button', { name: '最初から再生' }).click();
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    await page.getByRole('button', { name: '演出スキップ → NEXT MATCH' }).click();
    assert.match(await page.getByRole('status').textContent(), /手動開始待ち/);
    await page.screenshot({ path: 'docs/local-rehearsal-check/preview.png' });
    await page.goto(root + '/local-rehearsal');
    await page.getByRole('button', { name: '8名で準備' }).click();
    await page.getByRole('button', { name: 'チーム抽選・トーナメント生成' }).click();
    await page.getByRole('button', { name: '対戦紹介へ' }).click();
    await page.reload();
    await page.getByRole('heading', { name: 'NEXT MATCH', exact: true }).waitFor();
    await page.screenshot({ path: 'docs/local-rehearsal-check/bracket.png' });
    let games = 0;
    while (!(await page.getByRole('heading', { name: 'CHAMPION', exact: true }).count())) {
      await page.getByRole('button', { name: '試合開始 / START MATCH', exact: true }).click({ timeout: 10000 });
      await page.getByRole('button', { name: 'このチームの勝利を確定', exact: true }).first().click();
      await page.waitForFunction(() => ['result', 'finished'].includes(JSON.parse(localStorage.getItem('tournament.local-rehearsal.v1')).phase));
      games++;
      if (games > 40) throw new Error('Tournament did not finish');
      if (await page.getByRole('heading', { name: 'CHAMPION', exact: true }).count()) break;
      await page.getByRole('button', { name: 'NEXT MATCHへ（試合は開始しません）', exact: true }).click();
    }
    assert.ok(games >= 6 && games <= 7);
    await page.screenshot({ path: 'docs/local-rehearsal-check/champion.png' });
    await page.getByRole('button', { name: '直前の勝敗を戻す' }).click();
    await page.getByRole('heading', { name: 'NEXT MATCH', exact: true }).waitFor();
    await page.getByRole('button', { name: '端末内データ消去' }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'カメラ起動／撮り直し' }).click();
      await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
      await page.getByRole('button', { name: '撮影', exact: true }).click();
      await page.getByLabel('名前', { exact: true }).fill('カメラ検証' + i);
      await page.getByRole('button', { name: 'この端末に登録' }).click();
      await page.waitForFunction(count => JSON.parse(localStorage.getItem('tournament.local-rehearsal.v1')).players.length === count, i + 1);
    }
    await page.getByRole('button', { name: 'チーム抽選・トーナメント生成' }).click();
    await page.getByRole('heading', { name: '抽選結果 · 2チーム' }).waitFor();
    await page.screenshot({ path: 'docs/local-rehearsal-check/camera-draw.png' });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(JSON.stringify({ passed: true, games, cameraRegistrations: 4, errors, external, checks: ['preview controls', 'reload restore', 'manual start', 'full tournament', 'undo', 'fake camera registration', 'draw with captured photos'] }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
