import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // 'mpa' disables the SPA history-fallback middleware, so requests for
  // missing files (e.g. audio not added yet) correctly 404 instead of
  // silently serving index.html — which Phaser's loader would otherwise
  // download as "successful" and then hang trying to decode as audio.
  appType: 'mpa',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
  },
});
