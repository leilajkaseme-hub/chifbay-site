#!/usr/bin/env node
// measures.mjs: freeze each post's numbers at about 24 hours and 7 days.
//
//   node bin/measures.mjs insights.json
//
// The insights job reads every post once a day, so the live numbers keep
// growing and two posts of different ages cannot be compared. This keeps the
// first reading taken between 24 and 72 hours (h24) and between 7 and 14 days
// (d7), with
// the real age of the reading, in measures.json (committed, public, read by the
// Feed Planner). A reading is never overwritten. Our own id and format come
// from the ledger, matched on the media id.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readLedger } from "../lib/queue.mjs";

const FILE = join(ROOT, "measures.json");
const input = process.argv[2];
if (!input) { console.error("usage: node bin/measures.mjs insights.json"); process.exit(2); }
const ins = JSON.parse(readFileSync(input, "utf-8"));
const store = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf-8")) : { posts: {} };
const ours = new Map(readLedger().filter((e) => e.ok && e.media_id).map((e) => [String(e.media_id), e]));
const HOUR = 3_600_000;
const now = Date.parse(ins.collected_at) || Date.now();
const KEEP = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions", "follows",
  "profile_visits", "ig_reels_avg_watch_time"];

let added = 0;
for (const m of ins.media ?? []) {
  const age = (now - Date.parse(m.timestamp)) / HOUR;
  if (!Number.isFinite(age)) continue;
  const led = ours.get(String(m.id));
  const p = (store.posts[m.id] ??= {
    posted_at: m.timestamp, permalink: m.permalink, type: m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "photo",
    ours: led ? { id: led.id, format: led.format ?? null, source: led.source ?? null } : null,
  });
  const snap = () => ({ at: ins.collected_at, age_hours: Math.round(age), ...Object.fromEntries(KEEP.map((k) => [k, m.insights?.[k] ?? null])) });
  // Only close to the mark: a "24 h" reading taken a month later would lie.
  if (age >= 24 && age < 72 && !p.h24) { p.h24 = snap(); added++; }
  if (age >= 168 && age < 336 && !p.d7) { p.d7 = snap(); added++; }
}
store.updated_at = ins.collected_at;
writeFileSync(FILE, JSON.stringify(store, null, 1) + "\n");
console.log(`${added} new reading(s), ${Object.keys(store.posts).length} posts tracked`);
