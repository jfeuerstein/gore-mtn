import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Lists every file of the built game, with a short mark of what is in it, as `files.json`.
 * The service worker reads it to keep a copy of the whole game for playing with no signal:
 * the seasons not yet visited and the pictures not yet earned as well as what has been seen.
 * A file is fetched again only when its mark has changed.
 */
function filesList(): Plugin {
  let out = 'dist';
  return {
    name: 'gore-files-list',
    apply: 'build',
    configResolved(config) {
      out = config.build.outDir;
    },
    closeBundle() {
      const files: Record<string, string> = {};
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir).sort()) {
          const path = join(dir, name);
          if (statSync(path).isDirectory()) walk(path);
          else {
            const rel = relative(out, path).split('\\').join('/');
            // Not the worker (the browser keeps that itself), nor this list, nor an older face for older browsers.
            if (rel === 'sw.js' || rel === 'files.json' || rel.endsWith('.woff') || rel.endsWith('.map')) continue;
            files[rel] = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 12);
          }
        }
      };
      walk(out);
      writeFileSync(join(out, 'files.json'), JSON.stringify(files));
    },
  };
}

export default defineConfig({
  // Relative base so the same build works at a domain root and under /gore-mtn/ on GitHub Pages.
  base: './',
  plugins: [filesList()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
