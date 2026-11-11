import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildWorld, type World } from './world';

/** The real generated world, loaded from public/world for tests. Node only. */
export function loadTestWorld(): World {
  const read = (name: string): Buffer => readFileSync(new URL(`../../public/world/${name}`, import.meta.url));
  const bytes = (name: string): ArrayBuffer => {
    const b = gunzipSync(read(name));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  return buildWorld(JSON.parse(read('world.json').toString()), bytes('height.bin.gz'), bytes('trailmask.bin.gz'), bytes('open.bin.gz'), bytes('forest.bin.gz'));
}
