import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const repository = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: resolve(repository, 'checkin'), envDir: false, publicDir: false,
  resolve: { alias: { '/src': resolve(repository, 'src') }, preserveSymlinks: true },
  plugins: [react(), {
    name: 'checkin-isolation',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const path = id.replaceAll('\\', '/');
          const allowed = ['/src/checkin/', '/src/features/draw/presentationTypes.ts', '/src/features/draw/draw.ts', '/src/features/presentation/scenes/DrawStage.tsx', '/src/features/presentation/scenes/PairConfirmed.tsx', '/src/features/presentation/drawVisualState.ts', '/src/features/bracket/resultAdvance.ts', '/src/features/bracket/layout.ts', '/src/features/bracket/stageData.ts', '/src/features/bracket/BracketView.tsx', '/src/features/progression/tiers.ts', '/src/features/bracket/verticalText.ts', '/src/styles/bracketTheme.ts', '/src/features/presentation/postMatch/', '/src/features/presentation/backdrop/', '/src/features/presentation/vsBoard/', '/src/features/presentation/ceremony/', '/src/features/presentation/drawAnimationTiming.ts', '/src/preview/FixtureStage.tsx', '/src/preview/preview.css', '/src/assets/placeholder_face.svg', '/src/lib/tournamentEffects.ts', '/src/lib/rehearsalTiming.ts'];
          if (path.includes('/src/') && !path.includes('/node_modules/') && !allowed.some(prefix => path.includes(prefix))) this.error(`Unexpected application dependency: ${path}`);
          if (/ADMIN_API_TOKEN|DISPLAY_API_TOKEN|supabase\.co/.test(output.code)) this.error('Unexpected backend configuration in browser output');
        }
      }
      for (const asset of ['backgrounds/card-table-bg.webp', 'backgrounds/tournament-bg.webp', 'backgrounds/vs-idle.mp4', 'backgrounds/vs-black-hole.webp', 'backgrounds/draw-table.webp', 'backgrounds/dart-nebula.webp', 'backgrounds/pair-rings.webp', 'backgrounds/winner-shaft.webp', 'backgrounds/champion-corona.webp', 'cards/card-back.webp', 'cards/card-front.webp', 'cards/impact-mark.png', 'darts/dart-main.png', 'darts/dart-motion-streak.png', 'effects/impact-flash.png', 'effects/golden-sparks.png', 'effects/blue-ring.png', 'effects/impact-cloud.png', 'effects/debris.png', 'effects/celebration-confetti.png', 'effects/vs-mark.png', 'frames/nameplate.png', 'frames/player-frame.png', 'frames/team-plate.png', 'audio/dart-fly.mp3', 'audio/dragon-studio-hard-heavy-impact-515256.mp3', 'audio/card-flip.mp3', 'audio/team-confirm.mp3', 'audio/オープニング.mp3', 'audio/ペア.mp3', 'audio/トランプが開かれたとき.mp3', 'audio/audiopapkin-sound-design-elements-impact-sfx-ps-130-420088.mp3']) {
        const fileName = `tournament-effects/${asset}`;
        this.emitFile({ type: 'asset', fileName, source: readFileSync(resolve(repository, 'public', fileName)) });
      }
      const openingPoster = 'images/T-RIP 20周年記念ダーツトーナメント.png';
      this.emitFile({ type: 'asset', fileName: `tournament-effects/opening/${openingPoster.slice('images/'.length)}`, source: readFileSync(resolve(repository, 'public', openingPoster)) });
    },
  }],
  build: { outDir: resolve(repository, 'dist-checkin'), emptyOutDir: true, sourcemap: false },
});
