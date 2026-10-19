// sources.mjs: which source VIDEOS (not clips) went out lately, so the same footage is never planned again.
//
// Theo, 19 Oct 2026: "do not replan the same videos for Instagram, go and look in the Drive folder to make
// new ones". The old rule only looked at the clip: three clips cut from one phone video went out as three
// stories on three days in a row, and four of the six hand-made Reels were cut from the same two files.
// Now a source file is out of the rotation for SOURCE_DAYS after ANY clip, story or Reel of it was queued or posted.
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { ROOT } from "./queue.mjs";

export const SOURCE_DAYS = 60;
const DAY = 86_400_000;

const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(join(ROOT, file), "utf8")); } catch { return fallback; } };
const readLines = (file) => {
  const f = join(ROOT, file);
  return existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
};

/**
 * File names of every source video used within `days`: clips queued or posted (clip.used), and the shots of every
 * hand-made Reel that went out (ledger + reels-plan.json). `now` is injectable for tests.
 */
export function recentSources({ reels = readJson("reels.json", { clips: [] }), plan = readJson("reels-plan.json", { reels: [] }),
  ledger = readLines("ledger.jsonl"), days = SOURCE_DAYS, now = Date.now() } = {}) {
  const since = now - days * DAY;
  const out = new Set();
  for (const c of reels.clips ?? []) {
    const stamps = Object.values(c.used ?? {}).map(Number);
    if (c.source && stamps.some((t) => t > since)) out.add(c.source);
  }
  const shotsOf = new Map((plan.reels ?? []).map((r) => [r.id, (r.shots ?? []).map((s) => s.file).filter(Boolean)]));
  for (const e of ledger) {
    if (!e.ok || e.source !== "reel" || !(Date.parse(e.at) > since)) continue;
    for (const f of shotsOf.get(e.id) ?? []) out.add(f);
  }
  return out;
}
