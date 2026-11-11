// A small client for fal's queue API: submit a job, wait for it, and save what comes back.
//
// The API key is never in this repository or in an environment variable here. In a Claude Code
// cloud session it is a network secret that the session's proxy adds to requests for
// queue.fal.run. Node's own fetch does not go through that proxy unless told to, so run these
// tools with NODE_USE_ENV_PROXY=1 there. Run locally, set FAL_KEY and it is sent as fal expects.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const QUEUE = 'https://queue.fal.run';
const headers = () => ({ 'Content-Type': 'application/json', ...(process.env.FAL_KEY ? { Authorization: `Key ${process.env.FAL_KEY}` } : {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a model and return its output.
 * @param model a fal model id, such as "fal-ai/recraft/v3/text-to-image"
 * @param input the model's input, as its page describes
 */
export async function run(model, input, { timeoutMs = 600000 } = {}) {
  const submit = await fetch(`${QUEUE}/${model}`, { method: 'POST', headers: headers(), body: JSON.stringify(input) });
  if (!submit.ok) throw new Error(`fal refused the job (${submit.status}): ${(await submit.text()).slice(0, 300)}`);
  const job = await submit.json();
  const started = Date.now();
  for (;;) {
    await sleep(1500);
    const status = await (await fetch(job.status_url, { headers: headers() })).json();
    if (status.status === 'COMPLETED') {
      if (status.error) throw new Error(`fal job failed: ${status.error}`);
      break;
    }
    if (Date.now() - started > timeoutMs) throw new Error(`fal job ${job.request_id} did not finish in time`);
  }
  const result = await fetch(job.response_url, { headers: headers() });
  if (!result.ok) throw new Error(`fal result could not be read (${result.status}): ${(await result.text()).slice(0, 300)}`);
  return result.json();
}

/** Download a file fal has made and save it. */
export async function save(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not download ${url}: ${res.status}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}
