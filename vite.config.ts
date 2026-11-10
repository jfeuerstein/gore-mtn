import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works at a domain root and under /gore-mtn/ on GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
