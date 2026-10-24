import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vite.config';
import { cloudflareReadProxy } from './scripts/dev/cloudflareReadProxy';

// Also supports this PC's existing node_modules junction without new installs.
export default mergeConfig(base, defineConfig({
  resolve: { preserveSymlinks: true },
  plugins: [cloudflareReadProxy()],
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.dev.vars', '**/.dev.vars.*'] },
  },
}));
