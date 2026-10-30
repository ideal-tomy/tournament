// Read-only inventory. Never outputs credential values or arbitrary binding contents.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const candidates = [join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), join(process.env.USERPROFILE, '.wrangler/config/default.toml')];
const config = candidates.find(existsSync);
if (!config) throw Error('Existing Wrangler login not found');
const token = /oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(config, 'utf8'))?.[1];
if (!token) throw Error('Existing Wrangler OAuth login unavailable');
const account = '5b27490470fa62bc7b51865e4e2cd786';
async function get(path) {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + account + path, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
  const b = await r.json();
  if (!b.success) throw Error(`Inventory ${path}: HTTP ${r.status}; codes ${(b.errors ?? []).map(x => x.code).join(',')}`);
  return b.result;
}
const workers = (await get('/workers/scripts')).filter(x => /tournament/.test(x.id));
const results = [];
for (const w of workers) {
  const name = encodeURIComponent(w.id);
  const settings = await get(`/workers/scripts/${name}/settings`);
  const deployments = await get(`/workers/scripts/${name}/deployments`);
  results.push({ name: w.id, modified: w.modified_on, deployments: (deployments.deployments ?? []).slice(0, 1).map(x => ({ id: x.id, created: x.created_on, versions: x.versions })), bindings: (settings.bindings ?? []).map(x => ({ name: x.name, type: x.type, ...(x.type === 'd1' ? { databaseId: x.id } : {}), ...(x.type === 'r2_bucket' ? { bucket: x.bucket_name } : {}) })) });
}
mkdirSync('docs/environment-verification', { recursive: true });
writeFileSync('docs/environment-verification/workers.json', JSON.stringify({ checkedAt: new Date().toISOString(), workers: results }, null, 2));
const configs = {
 'tournament-animation-preview': ['旧演出素材Preview', 'cloudflare/wrangler.animation-preview.jsonc', '静的Preview'],
 'tournament-checkin-e2e': ['旧撮影登録E2E', 'cloudflare/checkin/wrangler.e2e.jsonc', '/checkin /display /api/*'],
 'tournament-checkin-rehearsal': ['通常大会の受付・進行（今回更新しない）', 'cloudflare/checkin/wrangler.jsonc', '/checkin /admin /display /show-preview /api/*'],
 'tournament-flow-e2e': ['旧抽選・進行E2E', 'cloudflare/checkin/wrangler.flow-e2e.jsonc', '受付・運営・Display・API'],
 'tournament-match-loop-e2e': ['旧試合ループE2E', 'cloudflare/checkin/wrangler.match-loop-e2e.jsonc', '受付・運営・Display・API'],
 'tournament-pair-gates-e2e': ['旧ペア発表gate E2E', 'cloudflare/checkin/wrangler.pair-gates-e2e.jsonc', '受付・運営・Display・API'],
 'tournament-rehearsal': ['旧token認証API', 'cloudflare/wrangler.jsonc（gitignore）', '/api/health /api/events/*'],
 'tournament-through-rehearsal': ['今後のcanonical', 'cloudflare/checkin/wrangler.through-rehearsal.jsonc', '/ /checkin /admin /display /rehearsal /show-preview /cloudflare-check /match-transition /api/*'],
};
let md='# 既存Cloudflare Worker棚卸し\n\nCloudflare APIからの読取。Secretは名前だけ取得し値は保存しない。deploy元と用途はrepo configから照合。旧Workerの全route実動作を再試験した一覧ではない。\n\n| Worker | 目的 | deploy元 | 最新稼働version | D1 | R2 | Static Assets | Secret名 | Route（repo実装） |\n|---|---|---|---|---|---|---|---|---|\n';
for(const w of results){const c=configs[w.name]??['要調査','不明','不明'];const types=t=>w.bindings.filter(x=>x.type===t);md+=`| ${w.name} | ${c[0]} | ${c[1]} | ${(w.deployments[0]?.versions??[]).map(x=>x.version_id).join(',')} | ${types('d1').length?'tournament-rehearsal-db':'なし'} | ${types('r2_bucket').map(x=>x.bucket).join(',')||'なし'} | ${types('assets').map(x=>x.name).join(',')||(w.name==='tournament-animation-preview'?'bindingなし（configで静的assets配信）':'なし')} | ${types('secret_text').map(x=>x.name).join(',')||'なし'} | ${c[2]} |\n`;}
md+='\n各version・照会日時・binding詳細は[workers.json](workers.json)。旧6検証Workerと通常受付Workerを変更・削除せず維持。複数Workerは過去の機能別検証が由来であり、今後の操作URLはthroughだけに統一する。\n';
writeFileSync('docs/environment-verification/WORKERS.md',md);
console.log(JSON.stringify({count:results.length,canonical:results.find(x=>x.name==='tournament-through-rehearsal')?.deployments[0]?.versions}));
