import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const secretsPath = 'cloudflare/checkin/.secrets.local';
const secrets = existsSync(secretsPath) ? JSON.parse(readFileSync(secretsPath, 'utf8')) : {
  REHEARSAL_ACCESS_CODE: randomBytes(12).toString('base64url'),
  SESSION_SECRET: randomBytes(32).toString('base64url'),
};
if (!existsSync(secretsPath)) writeFileSync(secretsPath, JSON.stringify(secrets), { mode: 0o600, flag: 'wx' });
if (!existsSync('cloudflare/checkin/.dev.vars')) writeFileSync('cloudflare/checkin/.dev.vars', Object.entries(secrets).map(([name, value]) => `${name}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
writeFileSync('.checkin-access.local', `大会受付・Display確認用コード（共有する相手を限定してください）\n\n確認コード: ${secrets.REHEARSAL_ACCESS_CODE}\n\n受付: https://tournament-checkin-rehearsal.pine-shaken.workers.dev/checkin\nDisplay: https://tournament-checkin-rehearsal.pine-shaken.workers.dev/display\n\n各端末で一度入力します。8時間で再入力が必要です。\nこのファイルと秘密設定はGit管理対象外です。\n`, { mode: 0o600 });
console.log('Checkin secrets prepared in ignored local files. Values were not printed.');
