// queue.mjs — the state layer for the Instagram auto-poster.
//
// Everything that decides "may this be posted?" lives here, so the two entry
// points (bin/topup.mjs, bin/post.mjs) stay small and boring.
//
// The safety model is the same one that has kept youtube-auto from ever
// double-posting, adapted to a git-backed queue:
//
//   1. move-on-success  — a queue item leaves queue/ the instant Instagram
//                         accepts it, so a crash mid-run never reposts it.
//   2. daily guard      — state.json records the last posted date in the
//                         island's timezone; a re-run on the same day is a
//                         no-op, not a second post.
//   3. lock file        — two overlapping runs cannot both publish.
//   4. ledger           — append-only record of every post ever made.
//   5. image hash       — the sha256 of every posted image is checked before
//                         publishing, so the same photo can never go out
//                         twice even if it re-enters the queue by another route.
//
// The queue is committed to the repo on purpose: it is reviewable from a
// phone in the GitHub app, and git history is a free audit trail.
import { createHash } from "node:crypto";
import {
  appendFileSync, existsSync, mkdirSync, readFileSync,
  readdirSync, renameSync, writeFileSync, rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ROOT = join(ROOT, "..");

const QUEUE_DIR = join(ROOT, "queue");
const POSTED_DIR = join(ROOT, "posted");
const LEDGER = join(ROOT, "ledger.jsonl");
const STATE = join(ROOT, "state.json");
const LOCK = join(ROOT, ".lock");

export const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8"));
export const brand = JSON.parse(readFileSync(join(ROOT, "brand.json"), "utf-8"));

export const publicDir = join(SITE_ROOT, config.public_dir);

export function ensureDirs() {
  for (const d of [QUEUE_DIR, POSTED_DIR, publicDir]) mkdirSync(d, { recursive: true });
}

/** Calendar date in the island's timezone, as YYYY-MM-DD. */
export function today(tz = config.timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function newId() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${createHash("sha256").update(String(process.hrtime.bigint())).digest("hex").slice(0, 4)}`;
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// --- queue -----------------------------------------------------------------

const readJson = (p, fallback = null) => {
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return fallback; }
};

/** Items written before stories existed are feed posts. */
export const kindOf = (item) => item?.kind ?? "feed";

/**
 * Queue items, oldest first — that is the order they get posted in.
 * Pass "feed" or "story" to get just that kind; omit for everything.
 */
export function listQueue(kind = null) {
  if (!existsSync(QUEUE_DIR)) return [];
  return readdirSync(QUEUE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(QUEUE_DIR, f)))
    .filter(Boolean)
    .filter((i) => !kind || kindOf(i) === kind)
    .sort((a, b) => String(a.created).localeCompare(String(b.created)));
}

export function writeItem(item) {
  mkdirSync(QUEUE_DIR, { recursive: true });
  writeFileSync(join(QUEUE_DIR, `${item.id}.json`), JSON.stringify(item, null, 2) + "\n");
}

/**
 * Move an item out of the queue after Instagram accepted it. The rename is the
 * commit point: if the process dies immediately after, the item is already gone
 * from the queue and cannot be picked again.
 */
export function markPosted(item, result) {
  mkdirSync(POSTED_DIR, { recursive: true });
  const src = join(QUEUE_DIR, `${item.id}.json`);
  const done = { ...item, posted_at: new Date().toISOString(), result };
  writeFileSync(src, JSON.stringify(done, null, 2) + "\n");
  renameSync(src, join(POSTED_DIR, `${item.id}.json`));
  if (existsSync(src)) throw new Error(`queue item ${item.id} did not leave the queue — refusing to continue`);
  return done;
}

export function dropItem(id) {
  const p = join(QUEUE_DIR, `${id}.json`);
  if (existsSync(p)) rmSync(p);
}

// --- ledger ----------------------------------------------------------------

export function appendLedger(entry) {
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

export function readLedger() {
  if (!existsSync(LEDGER)) return [];
  return readFileSync(LEDGER, "utf-8")
    .split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

const successes = () => readLedger().filter((e) => e.ok);

/** Every image sha256 we have ever published. Nothing in here may go out again. */
export function postedHashes() {
  return new Set(successes().map((e) => e.sha256).filter(Boolean));
}

/**
 * Source files used within the cooldown window. A real photo may come back
 * eventually, but not so soon that the feed looks like it is repeating itself.
 */
export function originsOnCooldown(days = config.library_reuse_days) {
  const cutoff = Date.now() - days * 86_400_000;
  return new Set(
    successes()
      .filter((e) => Date.parse(e.at || "") > cutoff)
      .map((e) => e.origin)
      .filter(Boolean),
  );
}

/** Recent posts, newest first — used by the caption and hashtag variety guards. */
export function recentPosts(n = 30) {
  return successes().slice(-n).reverse();
}

// --- guards ----------------------------------------------------------------

export function state() {
  return readJson(STATE, {}) ?? {};
}

export function saveState(patch) {
  writeFileSync(STATE, JSON.stringify({ ...state(), ...patch }, null, 2) + "\n");
}

/** Feed and story are guarded separately — one of each a day, not one in total. */
export const lastPostKey = (kind = "feed") =>
  kind === "feed" ? "last_post_date" : `last_${kind}_date`;

export function alreadyPostedToday(kind = "feed") {
  return state()[lastPostKey(kind)] === today();
}

/**
 * Cheap advisory lock. Anything older than an hour is treated as a crashed run
 * rather than a live one, so a killed job cannot block the queue forever.
 */
export async function withLock(fn) {
  if (existsSync(LOCK)) {
    const age = Date.now() - (readJson(LOCK, {})?.at ?? 0);
    if (age < 3_600_000) throw new Error("another run holds the lock — exiting");
  }
  writeFileSync(LOCK, JSON.stringify({ at: Date.now(), pid: process.pid }));
  // `await fn()` rather than `return fn()` — with a bare return the finally
  // block would drop the lock while the async work was still running.
  try { return await fn(); } finally { if (existsSync(LOCK)) rmSync(LOCK); }
}
