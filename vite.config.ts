/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          anim: ['gsap', 'howler'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});
