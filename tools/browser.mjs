// Shared headless browser for the tools. Rendering is done in software, so frame rates here mean
// nothing.
//
// The tools exercise the game's WebGL 2 path. The owner's phone uses WebGPU, which this headless
// browser can start but cannot show: it fails to create the canvas's swap-chain image and drops
// the GPU instance a fraction of a second after the first frame. `webgpu: true` is therefore only
// useful for tools/webgpu-smoke.mjs, which checks that those first frames raise no errors.
import { createRequire } from 'node:module';

// Resolved with require() so a globally installed Playwright (as in cloud sessions) is found too.
const playwright = createRequire(import.meta.url)('playwright');

export const devices = playwright.devices;

export function launchBrowser({ webgpu = false } = {}) {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (webgpu) args.push('--enable-unsafe-webgpu');
  return playwright.chromium.launch({ args });
}
