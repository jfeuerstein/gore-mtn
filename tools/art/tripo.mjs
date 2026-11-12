// A small client for Tripo's API (v3): start a task, wait for it, and save what comes back.
//
// As with fal, the API key is never in this repository or in an environment variable here. In a
// Claude Code cloud session it is a network secret that the session's proxy adds to requests
// for openapi.tripo3d.ai, so run these tools with NODE_USE_ENV_PROXY=1 there. Run locally, set
// TRIPO_KEY and it is sent as Tripo expects.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://openapi.tripo3d.ai/v3';
const headers = () => ({ 'Content-Type': 'application/json', ...(process.env.TRIPO_KEY ? { Authorization: `Bearer ${process.env.TRIPO_KEY}` } : {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a task and return its finished record (`output` holds what was made).
 * @param path the kind of task, such as "generation/text-to-image"
 * @param body the task's input, as its page in Tripo's docs describes
 */
export async function task(path, body, { timeoutMs = 900000 } = {}) {
  const made = await fetch(`${API}/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const start = await made.json().catch(() => ({}));
  if (!made.ok || start.code !== 0) throw new Error(`Tripo refused the task (${made.status}): ${JSON.stringify(start).slice(0, 300)}`);
  const id = start.data.task_id;
  // Said aloud, so that a task already paid for can be found again if this run is cut short.
  console.error(`Tripo task ${id} (${path}) started`);
  const began = Date.now();
  for (;;) {
    await sleep(3000);
    // A dropped connection while waiting is no reason to give the task up: it is still being made, and has been paid for.
    const res = await fetch(`${API}/tasks/${id}`, { headers: headers() }).catch(() => null);
    if (!res) {
      if (Date.now() - began > timeoutMs) throw new Error(`Tripo task ${id} could not be asked after in time`);
      continue;
    }
    const now = (await res.json().catch(() => ({}))).data ?? {};
    if (now.status === 'success') return now;
    if (['failed', 'cancelled', 'banned', 'expired'].includes(now.status)) throw new Error(`Tripo task ${id} ${now.status}: ${now.error_message ?? ''}`);
    if (Date.now() - began > timeoutMs) throw new Error(`Tripo task ${id} did not finish in time`);
  }
}

/** Download a file Tripo has made and save it. */
export async function save(url, path) {
  // Tried a few times: what is being fetched has been paid for.
  let res = null;
  for (let tries = 0; tries < 4 && !res?.ok; tries++) {
    if (tries) await sleep(4000);
    res = await fetch(url).catch(() => null);
  }
  if (!res?.ok) throw new Error(`could not download ${url}: ${res?.status ?? 'no answer'}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}
