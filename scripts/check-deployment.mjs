// Bundle validation only. This script never uploads, migrates, or changes secrets.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const [name, config] of [
  ['normal', 'cloudflare/checkin/wrangler.jsonc'],
  ['rehearsal', 'cloudflare/checkin/wrangler.through-rehearsal.jsonc'],
]) {
  console.log(`Deployment dry-run: ${name}`);
  const code = await new Promise((fulfill, reject) => {
    const child = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'deploy', '--config', resolve(root, config), '--dry-run', '--outdir', resolve(root, '.wrangler/deploy-check', name)],
    { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
    child.once('error', reject); child.once('exit', fulfill);
  });
  if (code !== 0) { process.exitCode = code || 1; break; }
}
