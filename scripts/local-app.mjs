import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const config = 'cloudflare/local/wrangler.jsonc';
const storage = '.wrangler/local-app';
const mode = process.argv[2] ?? 'dev';
if (!['dev', 'preview', 'setup', 'query'].includes(mode)) throw Error('Unknown local mode');
const port = Number(process.env.PORT ?? 5174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be 1024..65535');
if (!existsSync(wrangler)) throw Error('Wrangler is missing. See README prerequisites. No packages were installed.');
const children = new Set();
let stopping = false;
function start(script, args) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
  });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}
function run(script, args) {
  return new Promise((fulfill, reject) => {
    const child = start(script, args);
    child.once('error', reject);
    child.once('exit', code => code === 0 ? fulfill() : reject(Error(`Command failed (${code}): ${script}`)));
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
async function checkPort() {
  await new Promise((fulfill, reject) => {
    const server = createServer();
    server.once('error', () => reject(Error(`Port ${port} is in use. Keep the existing server; set PORT to another port.`)));
    server.listen(port, '127.0.0.1', () => server.close(fulfill));
  });
}
try {
  if (mode === 'query') {
    const sql = process.argv[3];
    if (!sql || !/^\s*SELECT\b/i.test(sql)) throw Error('query accepts one SELECT only');
    await run(wrangler, ['d1', 'execute', 'DB', '--config', config, '--local', '--persist-to', storage, '--command', sql, '--json']);
  } else {
    if (mode !== 'setup') await checkPort();
    mkdirSync(resolve(root, 'cloudflare/local'), { recursive: true });
    const secretFile = resolve(root, 'cloudflare/local/.dev.vars');
    if (!existsSync(secretFile)) {
      writeFileSync(secretFile, `REHEARSAL_ACCESS_CODE=${randomBytes(18).toString('base64url')}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 });
    }
    if (mode === 'dev' || !existsSync(resolve(root, 'dist-checkin/index.html'))) {
      await run(resolve(root, 'node_modules/typescript/bin/tsc'), ['-b']);
      await run(resolve(root, 'node_modules/typescript/bin/tsc'), ['-p', 'cloudflare/checkin/tsconfig.json']);
      await run(resolve(root, 'node_modules/vite/bin/vite.js'), ['build', '--config', 'vite.checkin.config.ts']);
    }
    await run(wrangler, ['d1', 'migrations', 'apply', 'DB', '--config', config, '--local', '--persist-to', storage]);
    await run(wrangler, ['d1', 'execute', 'DB', '--config', config, '--local', '--persist-to', storage, '--file', 'cloudflare/local/seed.sql']);
    if (mode !== 'setup') {
      console.log(`\nCloudflare app: http://localhost:${port}/rehearsal\nAccess code: REHEARSAL_ACCESS_CODE in cloudflare/local/.dev.vars (local only).\nCreate a rehearsal first; open Admin/Display using the links with ?run=...\n`);
      if (mode === 'dev') {
        const watcher = start(resolve(root, 'node_modules/vite/bin/vite.js'), ['build', '--config', 'vite.checkin.config.ts', '--watch', '--emptyOutDir', 'false']);
        watcher.once('exit', code => { if (!stopping) stop(code || 1); });
      }
      const server = start(wrangler, ['dev', '--config', config, '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', storage, '--live-reload']);
      server.once('exit', code => { if (!stopping) stop(code || 0); });
    }
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
