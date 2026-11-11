/**
 * What the player has done, in a form that can be stored and restored. No DOM here.
 *
 * The save is small and plain: it is kept in the browser's storage, and can be copied out as a
 * code and pasted back in, which is the only backup a web game on a phone has.
 */
export const SAVE_VERSION = 1;

export interface TrailProgress {
  /** One character per checkpoint down the trail: '1' if it has been skied past. */
  seen: string;
  /** The day the stamp was earned, as YYYY-MM-DD, once it has been. */
  stamped?: string;
}

export interface MineralRecord {
  count: number;
  /** Largest specimen found, in centimetres. */
  best: number;
  /** The day the first one was found. */
  first: string;
}

export interface SaveData {
  version: number;
  /** By trail name, and by the name of a path through the woods. */
  trails: Record<string, TrailProgress>;
  paths: Record<string, TrailProgress>;
  /** Day each was earned, by lift name, peak id, landmark id and condition id. */
  lifts: Record<string, string>;
  peaks: Record<string, string>;
  landmarks: Record<string, string>;
  conditions: Record<string, string>;
  /** Day each summit was first stood on in each season, by "peak:season"; and the day each season was first visited. */
  seasonPeaks: Record<string, string>;
  seasons: Record<string, string>;
  /** By mineral id. */
  minerals: Record<string, MineralRecord>;
  /** Finds picked up today, so they do not come back until tomorrow. */
  found: { day: string; spots: string[] };
  /** The field guide, by species id: how many times each has been seen, and the day of the first. */
  sightings: Record<string, { count: number; first: string }>;
  /** Sightings made (or startled away) in the present watch of the present day, so they are not met twice. */
  seen: { watch: string; spots: string[] };
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    trails: {},
    paths: {},
    lifts: {},
    peaks: {},
    landmarks: {},
    conditions: {},
    seasonPeaks: {},
    seasons: {},
    minerals: {},
    found: { day: '', spots: [] },
    sightings: {},
    seen: { watch: '', spots: [] },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function days(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (isRecord(v)) for (const [k, d] of Object.entries(v)) if (isDay(d)) out[k] = d;
  return out;
}

function progress(v: unknown): Record<string, TrailProgress> {
  const out: Record<string, TrailProgress> = {};
  if (!isRecord(v)) return out;
  for (const [name, t] of Object.entries(v)) {
    if (!isRecord(t) || typeof t.seen !== 'string' || !/^[01]*$/.test(t.seen)) continue;
    out[name] = isDay(t.stamped) ? { seen: t.seen, stamped: t.stamped } : { seen: t.seen };
  }
  return out;
}

/**
 * Read a save from stored text. Anything missing or malformed is dropped rather than trusted, so
 * a damaged or hand-edited save can never break the game; at worst some progress is lost.
 */
export function parseSave(text: string | null | undefined): SaveData {
  const save = emptySave();
  if (!text) return save;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return save;
  }
  if (!isRecord(raw)) return save;

  save.trails = progress(raw.trails);
  save.paths = progress(raw.paths);
  save.seasonPeaks = days(raw.seasonPeaks);
  save.seasons = days(raw.seasons);
  // A book from before the seasons were told apart was filled in winter.
  if (!isRecord(raw.seasonPeaks)) for (const [id, day] of Object.entries(days(raw.peaks))) save.seasonPeaks[`${id}:winter`] = day;
  save.lifts = days(raw.lifts);
  save.peaks = days(raw.peaks);
  save.landmarks = days(raw.landmarks);
  save.conditions = days(raw.conditions);
  if (isRecord(raw.minerals)) {
    for (const [id, m] of Object.entries(raw.minerals)) {
      if (!isRecord(m) || typeof m.count !== 'number' || typeof m.best !== 'number' || !isDay(m.first)) continue;
      if (!Number.isFinite(m.count) || !Number.isFinite(m.best) || m.count < 1) continue;
      save.minerals[id] = { count: Math.floor(m.count), best: m.best, first: m.first };
    }
  }
  if (isRecord(raw.found) && isDay(raw.found.day) && Array.isArray(raw.found.spots)) {
    save.found = { day: raw.found.day, spots: raw.found.spots.filter((s): s is string => typeof s === 'string') };
  }
  if (isRecord(raw.sightings)) {
    for (const [id, m] of Object.entries(raw.sightings)) {
      if (!isRecord(m) || typeof m.count !== 'number' || !Number.isFinite(m.count) || m.count < 1 || !isDay(m.first)) continue;
      save.sightings[id] = { count: Math.floor(m.count), first: m.first };
    }
  }
  if (isRecord(raw.seen) && typeof raw.seen.watch === 'string' && Array.isArray(raw.seen.spots)) {
    save.seen = { watch: raw.seen.watch, spots: raw.seen.spots.filter((s): s is string => typeof s === 'string') };
  }
  return save;
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

/** A save as a code to copy somewhere safe. */
export function saveToCode(save: SaveData): string {
  return `GORE1.${btoa(unescape(encodeURIComponent(serializeSave(save))))}`;
}

/** A save from a code, or null if the code is not one of ours. */
export function saveFromCode(code: string): SaveData | null {
  const m = /^GORE1\.([A-Za-z0-9+/=]+)$/.exec(code.trim());
  if (!m) return null;
  try {
    const text = decodeURIComponent(escape(atob(m[1] as string)));
    JSON.parse(text);
    return parseSave(text);
  } catch {
    return null;
  }
}

/** A calendar day as YYYY-MM-DD, in the player's own time zone. */
export function dayKey(when: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}`;
}
