import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repository = fileURLToPath(new URL('.', import.meta.url));
const assets = [
  'tournament-effects/cards/card-back.webp',
  'tournament-effects/cards/card-front.webp',
  'tournament-effects/darts/dart-main.png',
  'tournament-effects/effects/celebration-confetti.png',
  'tournament-effects/backgrounds/tournament-bg.webp',
  'tournament-effects/darts/dart-motion-streak.png',
  'tournament-effects/effects/golden-sparks.png',
  'tournament-effects/effects/blue-ring.png',
  'tournament-effects/effects/impact-cloud.png',
  'tournament-effects/effects/debris.png',
  'tournament-effects/effects/impact-flash.png',
];
const allowed = [
  '/src/preview/', '/src/assets/', '/src/features/presentation/postMatch/', '/src/features/presentation/backdrop/',
  '/src/features/presentation/drawAnimationTiming.ts', '/src/lib/tournamentEffects.ts',
];
export default defineConfig({
  root: resolve(repository, 'preview'),
  envDir: false,
  publicDir: false,
  resolve: { alias: { '/src': resolve(repository, 'src') }, preserveSymlinks: true },
  plugins: [react(), {
    name: 'isolated-animation-preview',
    generateBundle(_options, bundle) {
      const moduleIds = Object.values(bundle).flatMap(output => output.type === 'chunk' ? Object.keys(output.modules) : []);
      for (const id of moduleIds) {
        const normalized = id.replaceAll('\\', '/');
        if (normalized.includes('/src/') && !normalized.includes('/node_modules/') && !allowed.some(path => normalized.includes(path))) {
          this.error(`Unexpected application dependency in preview: ${normalized}`);
        }
        if (/node_modules\/(@supabase|@mediapipe)\//.test(normalized)) this.error('Backend or camera SDK included in animation preview');
      }
      for (const path of assets) this.emitFile({ type: 'asset', fileName: path, source: readFileSync(resolve(repository, 'public', path)) });
      const policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
      this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n  Content-Security-Policy: ${policy}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Robots-Tag: noindex, nofollow\n` });
      this.emitFile({ type: 'asset', fileName: 'preview-build.json', source: JSON.stringify({ fixtureOnly: true, scenes: ['draw', 'result', 'bracket', 'vs', 'next', 'champion'], applicationModules: moduleIds.filter(id => id.replaceAll('\\', '/').includes('/src/') && !id.includes('node_modules')).map(id => id.replaceAll('\\', '/').split('/src/')[1]) }, null, 2) });
    },
  }],
  build: { outDir: resolve(repository, 'dist-animation-preview'), emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
});
