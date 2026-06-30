/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      events: 'events',
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
});
