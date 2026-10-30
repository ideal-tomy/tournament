// Ensure the isolated Cloudflare frontend has no Supabase endpoints or client tokens.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const assets = join('dist-checkin', 'assets');
if (!existsSync(assets)) throw Error('Build the Cloudflare frontend first');
const files = readdirSync(assets).filter(name => name.endsWith('.js'));
if (!files.length) throw Error('No frontend JavaScript bundle found');
const bundle = files.map(name => readFileSync(join(assets, name), 'utf8')).join('\n');
const forbidden = [/supabase\.co/i, /ADMIN_API_TOKEN/, /DISPLAY_API_TOKEN/, /VITE_[A-Z0-9_]*TOKEN/];
for (const pattern of forbidden) if (pattern.test(bundle)) throw Error('Disallowed backend reference in frontend bundle: ' + pattern);
const privateFiles = ['cloudflare/checkin/.secrets.local', '.checkin-access.local'];
let checkedValues = 0;
for (const file of privateFiles) {
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, 'utf8');
  const values = file.endsWith('.json') ? Object.values(JSON.parse(raw)) : raw.split(/\r?\n/).map(line => line.slice(line.indexOf('=') + 1));
  for (const value of values) if (typeof value === 'string' && value.length >= 16) {
    checkedValues++;
    if (bundle.includes(value)) throw Error('A configured secret value appears in the frontend bundle');
  }
}
console.log(JSON.stringify({ bundles: files.length, disallowedReferences: 0, secretValuesChecked: checkedValues }));
mkdirSync('docs/environment-verification', { recursive: true });
writeFileSync('docs/environment-verification/bundle.json', JSON.stringify({ checkedAt: new Date().toISOString(), bundles: files.length, disallowedReferences: 0, secretValuesChecked: checkedValues }, null, 2));
