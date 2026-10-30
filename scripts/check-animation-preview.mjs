import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const output = resolve('dist-animation-preview');
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}
const paths = files(output);
const text = paths.filter(path => /\.(js|css|json|html)$/.test(path)).map(path => readFileSync(path, 'utf8')).join('\n');
assert.ok(!paths.some(path => /\.map$|\.env|\.dev\.vars|AdminPage|DisplayPage|images[\\/]/.test(relative(output, path))), 'Unexpected file in preview output');
assert.ok(!/ADMIN_API_TOKEN|DISPLAY_API_TOKEN|supabase\.co|__cloudflare_check/.test(text), 'Backend configuration found in output');
const knownSecrets = [];
for (const path of ['cloudflare/.dev.vars', '.env.cloudflare-check.local', '.env.local']) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?[A-Z_]*(?:TOKEN|SECRET|KEY)[A-Z_]*\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[1].replace(/^['"]|['"]$/g, '');
    if (value.length >= 16) knownSecrets.push(value);
  }
}
assert.ok(!knownSecrets.some(secret => text.includes(secret)), 'Private setting found in output');
const manifest = JSON.parse(readFileSync(resolve(output, 'preview-build.json'), 'utf8'));
assert.equal(manifest.fixtureOnly, true);
assert.equal(manifest.scenes.length, 6);
console.log(JSON.stringify({ files: paths.length, fixtureOnly: true, applicationModules: manifest.applicationModules, privateSettingScanPassed: true }));
