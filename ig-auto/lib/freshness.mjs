// freshness.mjs — what has been shown, and what nobody has seen yet.
//
// The old rule only remembered COVERS. Swipe photos were "reusable" by design,
// so with a library of about 60 photos and 4 photos per carousel, every photo
// had appeared around three times by late September and followers saw the same
// pictures again and again. Here every photo in a post counts, cover or not.
//
// Two answers:
//   usage()       origin -> when it was last shown (posted or waiting in the queue)
//   freshFirst()  photos never shown at all, newest arrival first
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE_ROOT, listQueue } from "./queue.mjs";
import { libraryFiles } from "./image.mjs";

const POSTED_DIR = join(ROOT, "posted");
const DRIVE_STATE = join(ROOT, "drive-state.json");

function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }

/** Every origin an item shows: its cover and every slide. */
export function originsOf(item) {
  const set = new Set();
  if (item?.origin) set.add(item.origin);
  for (const s of item?.slides ?? []) if (s?.origin) set.add(s.origin);
  if (item?.plan_cover) set.add(item.plan_cover);
  return [...set];
}

/**
 * origin -> ms of the last time it was shown. Things waiting in the queue count
 * as shown today: they are already spoken for. Posted items come from posted/,
 * which keeps the slides, not from the ledger, which only kept the cover.
 */
export function usage({ posted = null, queued = null } = {}) {
  const map = new Map();
  const note = (o, t) => { if (!map.has(o) || map.get(o) < t) map.set(o, t); };
  const postedItems = posted ?? (existsSync(POSTED_DIR)
    ? readdirSync(POSTED_DIR).filter((f) => f.endsWith(".json")).map((f) => readJson(join(POSTED_DIR, f))).filter(Boolean)
    : []);
  for (const it of postedItems) {
    const t = Date.parse(it.posted_at || it.created || "") || 0;
    for (const o of originsOf(it)) note(o, t);
  }
  const now = Date.now();
  for (const it of queued ?? listQueue()) for (const o of originsOf(it)) note(o, now);
  return map;
}

/** Shown within the last `days`, or waiting in the queue. */
export function usedWithin(days, used = usage()) {
  const cutoff = Date.now() - days * 86_400_000;
  return new Set([...used].filter(([, t]) => t >= cutoff).map(([o]) => o));
}

/** When each library file arrived: the Drive pull time, else the file's mtime. */
function arrivals() {
  const map = new Map();
  const st = readJson(DRIVE_STATE);
  for (const v of Object.values(st?.pulled ?? {})) {
    const dir = v.dir ?? "social-drive";
    map.set(`${dir}/${v.name}`, Date.parse(v.pulledAt || v.createdTime || "") || 0);
  }
  return map;
}

/** Library photos never shown anywhere, newest arrival first. */
export function freshFirst(kind = "feed", used = usage()) {
  const arr = arrivals();
  return libraryFiles(kind)
    .filter((f) => !used.has(f.origin))
    .map((f) => ({ ...f, arrived: arr.get(f.origin) ?? safeMtime(join(SITE_ROOT, f.origin)) }))
    .sort((a, b) => b.arrived - a.arrived);
}

function safeMtime(p) { try { return statSync(p).mtimeMs; } catch { return 0; } }
