// Prepare 40-team instant harness, verify partial autoplay, open /rehearsal-press for one-button UI.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { parseEnv } = require('node:util');
const { randomUUID } = require('node:crypto');

const root = `http://127.0.0.1:${process.env.PORT ?? 5174}`;
const outFile = '.wrangler/rehearsal-press-ready.json';
const secrets = parseEnv(fs.readFileSync('cloudflare/local/.dev.vars', 'utf8'));
const PARTIAL = Number(process.env.PARTIAL_MATCH_GOAL ?? 20);

let cookie = '';

async function health() {
  try {
    const response = await fetch(`${root}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function call(path, { method = 'GET', body, run } = {}) {
  const url = run ? `${root}${path}${path.includes('?') ? '&' : '?'}run=${encodeURIComponent(run)}` : `${root}${path}`;
  const headers = { Origin: root, Cookie: cookie };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(url, { method, headers, body });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, setCookie: response.headers.get('set-cookie') };
}

async function login() {
  const result = await call('/api/session', { method: 'POST', body: { code: secrets.REHEARSAL_ACCESS_CODE } });
  if (result.status !== 200) throw new Error('ログイン失敗。npm run dev が動いているか確認してください。');
  cookie = result.setCookie?.split(';')[0] ?? '';
  if (!cookie) throw new Error('セッションCookieを取得できませんでした。');
}

async function prepareFresh() {
  const prepared = await call('/api/rehearsal/prepare-progression', {
    method: 'POST',
    body: {
      requestId: randomUUID(),
      format: 'double_elimination',
      title: '進行ロジック確認（押すだけ）',
      teams: 40,
      courts: 2,
    },
  });
  if (prepared.status !== 200) throw new Error(`準備失敗: ${JSON.stringify(prepared.json)}`);
  return prepared.json.eventId;
}

async function verifyPartial() {
  const { spawn: runVerify } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = runVerify(
      process.execPath,
      ['scripts/verify-rehearsal-autoplay.cjs'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(new URL(root).port || 5174),
          PROGRESSION_TEAMS: '40',
          PARTIAL_MATCH_GOAL: '2',
        },
        stdio: 'inherit',
      },
    );
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('自動進行のAPI検証に失敗しました'))));
  });
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
}

(async () => {
  if (!(await health())) {
    console.error('ローカルサーバーが起動していません。別ターミナルで npm run dev を実行してから再試行してください。');
    process.exitCode = 1;
    return;
  }
  await login();
  await verifyPartial();
  const run = await prepareFresh();
  const pressUrl = `${root}/rehearsal-press?run=${encodeURIComponent(run)}`;
  const displayUrl = `${root}/display?run=${encodeURIComponent(run)}`;
  const payload = {
    readyAt: new Date().toISOString(),
    run,
    pressUrl,
    displayUrl,
    accessCode: secrets.REHEARSAL_ACCESS_CODE,
    hint: 'ログイン済みでない場合は確認コードを入力。部分確認ボタンを1回押すだけ。',
  };
  fs.mkdirSync('.wrangler', { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log('\n押すだけページの準備完了');
  console.log(`  ${pressUrl}`);
  console.log(`  Display: ${displayUrl}`);
  console.log(`  確認コード（未ログイン時）: ${secrets.REHEARSAL_ACCESS_CODE}`);
  console.log(`  状態ファイル: ${outFile}`);
  openBrowser(pressUrl);
})().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});