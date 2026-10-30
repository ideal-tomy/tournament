const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = process.argv[2] || 'http://127.0.0.1:4175';
const output = process.argv[3] || 'docs/animation-preview-verification/local';
const scenes = ['draw', 'result', 'bracket', 'vs', 'next', 'champion'];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const problems = [], external = [], writes = [], responses = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => problems.push(e.message));
    page.on('request', r => {
      if (new URL(r.url()).origin !== new URL(root).origin && !r.url().startsWith('data:')) external.push(r.url());
      if (!['GET', 'HEAD'].includes(r.method())) writes.push(r.method());
      assert.equal(r.headers().authorization, undefined);
    });
    page.on('response', r => { if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() }); });
    for (const scene of scenes) {
      await page.goto(`${root}/?scene=${scene}&mode=full`);
      await page.getByRole('heading', { name: 'Animation Preview', exact: true }).waitFor();
      await page.getByRole('button', { name: '最初から再生', exact: true }).click();
      await page.waitForTimeout(180);
      await page.getByRole('button', { name: '一時停止', exact: true }).click();
      assert.match(await page.getByRole('status').first().textContent(), /停止中/);
      await page.getByRole('button', { name: '再開', exact: true }).click();
      await page.getByRole('button', { name: 'スキップ', exact: true }).click();
      assert.match(await page.getByRole('status').first().textContent(), scene === 'next' ? /手動開始待ち/ : /再生完了/);
      await page.screenshot({ path: `${output}/${scene}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    }
    for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(viewport);
      for (const scene of scenes) {
        await page.goto(`${root}/?scene=${scene}&mode=lite&fixture=long`);
        await page.getByRole('button', { name: 'スキップ', exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${scene} ${viewport.width}`);
      }
      await page.screenshot({ path: `${output}/responsive-${viewport.width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${root}/?scene=champion&controls=0&mode=short&autoplay=1`);
    await page.waitForTimeout(3700);
    const stage = await page.locator('.pm-stage').boundingBox();
    assert.ok(Math.abs(stage.width - 1920) < 2 && Math.abs(stage.height - 1080) < 2);
    await page.screenshot({ path: `${output}/monitor-1920.png` });
    await page.getByRole('button', { name: '操作を表示' }).click();
    await page.goto(`${root}/?scene=all&mode=lite&autoplay=1`);
    await page.getByRole('status').filter({ hasText: '手動開始待ち' }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.getByRole('heading', { name: 'NEXT MATCH', exact: true }).waitFor();
    await page.getByRole('button', { name: '優勝演出へ進む' }).click();
    await page.getByRole('status').filter({ hasText: '再生完了' }).waitFor();
    await page.getByRole('heading', { name: 'Champion', exact: true }).waitFor();
    await page.getByRole('button', { name: '最初から再生', exact: true }).click();
    await page.getByRole('heading', { name: 'Draw', exact: true }).waitFor();
    await page.goto(`${root}/?scene=unknown&mode=unknown`);
    await page.getByRole('heading', { name: 'Draw', exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(root);
    assert.equal(await page.getByRole('combobox').inputValue(), 'lite');
    assert.deepEqual(problems, []);
    assert.deepEqual(external, []);
    assert.deepEqual(writes, []);
    assert.deepEqual(responses, []);
    const report = { root, scenes, viewportChecks: [360, 390, 844, 1366, 1440, 1920], browser: 'installed Chromium (automated, not physical devices)', jsErrors: problems, externalRequests: external, writes, failedResponses: responses, nextMatchHold: true, reducedMotion: true };
    fs.writeFileSync(`${output}/result.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
