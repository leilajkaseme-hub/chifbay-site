// The rules that keep the feed from repeating itself, EXECUTED on fixtures.
import assert from "node:assert/strict";
import { originsOf, usage, usedWithin } from "./lib/freshness.mjs";
import { pickWindows } from "./lib/reels.mjs";

let passed = 0; const failures = [];
const check = (name, fn) => { try { fn(); passed++; } catch (e) { failures.push(`${name}: ${e.message}`); } };
const day = 86_400_000, now = Date.now();

check("every photo in a post counts, not only the cover", () => {
  const it = { origin: "a.jpg", slides: [{ origin: "a.jpg" }, { origin: "b.jpg" }, { origin: "c.jpg" }] };
  assert.deepEqual(originsOf(it).sort(), ["a.jpg", "b.jpg", "c.jpg"]);
});

check("a slide shown 10 days ago is still on cooldown at 90 days", () => {
  const posted = [{ posted_at: new Date(now - 10 * day).toISOString(), origin: "a.jpg", slides: [{ origin: "b.jpg" }] }];
  const used = usage({ posted, queued: [] });
  assert.ok(usedWithin(90, used).has("b.jpg"));
});

check("a photo shown 100 days ago is free again", () => {
  const posted = [{ posted_at: new Date(now - 100 * day).toISOString(), origin: "old.jpg" }];
  assert.ok(!usedWithin(90, usage({ posted, queued: [] })).has("old.jpg"));
});

check("anything waiting in the queue is taken", () => {
  const used = usage({ posted: [], queued: [{ origin: "q.jpg", slides: [{ origin: "q2.jpg" }] }] });
  assert.ok(usedWithin(1, used).has("q2.jpg"));
});

// Half-second samples: t, light, colour.
const samples = (from, to, y, sat) => {
  const out = []; for (let t = from; t < to; t += 0.5) out.push({ t, YAVG: y, SATAVG: sat }); return out;
};

check("a clip never runs across a cut", () => {
  const m = { samples: [...samples(0, 20, 110, 10), ...samples(20, 40, 110, 10)], cuts: [20] };
  for (const w of pickWindows(m, 40)) assert.ok(w.start + w.len <= 20 || w.start >= 20, JSON.stringify(w));
});

check("a sharp jump in colour counts as a cut even when ffmpeg missed it", () => {
  const m = { samples: [...samples(0, 20, 110, 8), ...samples(20, 40, 110, 14)], cuts: [] };
  for (const w of pickWindows(m, 40)) assert.ok(w.start + w.len <= 20.1 || w.start >= 20, JSON.stringify(w));
});

check("a colour glitch far above the video's median is refused, not rewarded", () => {
  const m = { samples: [...samples(0, 30, 110, 9), ...samples(30, 40, 110, 30), ...samples(40, 70, 110, 9)], cuts: [] };
  for (const w of pickWindows(m, 70)) assert.ok(w.start + w.len <= 30 || w.start >= 40, JSON.stringify(w));
});

check("dark stretches and title cards at the edges are left out", () => {
  const m = { samples: [...samples(0, 30, 20, 12), ...samples(30, 60, 110, 10)], cuts: [] };
  const w = pickWindows(m, 60);
  assert.ok(w.length && w.every((x) => x.start >= 30 && x.start + x.len <= 54), JSON.stringify(w));
});

if (failures.length) { console.error(`${failures.length} FAILED, ${passed} passed`); failures.forEach((f) => console.error("  - " + f)); process.exit(1); }
console.log(`${passed} checks passed`);
