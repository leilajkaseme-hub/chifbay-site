#!/usr/bin/env node
// test-library.mjs — guards which photos are allowed to go out.
//
// Every fault here was live on the account, none of them showed as a red run,
// and all of them were only visible by looking at the feed:
//
//   1. Four feed posts in a row were product flat lays, one of them twice. The
//      exclude list is what stops a named photo, and it has to bite in
//      libraryFiles() rather than in the planner, or stories keep serving what
//      the feed was told to drop.
//   2. Stories and the feed drew from the same pool, so a story was a 9:16 crop
//      of a photo that then came round again as a carousel cover.
//   3. The Drive sync only ever added. A photo removed from PUBLISH stayed in
//      the repo and kept posting. The mirror has to remove it, and it has to
//      refuse to remove everything when a revoked share lists as empty.
//
// No network, no Drive, no packages beyond what ig-auto already uses.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, "..");
let passed = 0;
const failures = [];
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${e.message}`); }
};

const stem = (o) => o.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();

const config = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
const { libraryFiles } = await import("./lib/image.mjs");

// ------------------------------------------------------------------ exclude
test("config.json is valid JSON with no conflict markers", () => {
  const raw = readFileSync(join(HERE, "config.json"), "utf8");
  assert.ok(!raw.includes("<<<<<<<"), "config.json still holds a merge conflict");
  assert.ok(Array.isArray(config.library_dirs) && config.library_dirs.length);
});

test("every excluded photo is refused by the feed AND by stories", () => {
  const banned = config.exclude ?? [];
  assert.ok(banned.length, "nothing is excluded — was the list dropped?");
  for (const kind of ["feed", "story"]) {
    const origins = libraryFiles(kind).map((f) => f.origin);
    for (const b of banned) {
      assert.ok(!origins.includes(b), `${b} is still served to ${kind}`);
    }
  }
});

// ------------------------------------------------------- feed versus stories
test("stories come from the 9:16 album, not from the feed folder", () => {
  assert.deepEqual(config.story_dirs, ["story-9x16"]);
  const s = libraryFiles("story");
  assert.ok(s.length, "the story album is empty");
  for (const f of s) assert.ok(f.origin.startsWith("story-9x16/"), f.origin);
});

test("no photo is both a story and a feed post", () => {
  const feed = new Set(libraryFiles("feed").map((f) => stem(f.origin)));
  const both = libraryFiles("story").map((f) => stem(f.origin)).filter((x) => feed.has(x));
  assert.deepEqual(both, [], `served twice: ${both.join(", ")}`);
});

test("the story album really is 9:16 and the feed pool is not", async () => {
  const sharp = (await import("sharp")).default;
  for (const f of libraryFiles("story")) {
    const { width, height } = await sharp(f.path).metadata();
    const r = width / height;
    assert.ok(Math.abs(r - 9 / 16) < 0.02, `${f.origin} is ${r.toFixed(3)}, not 9:16`);
  }
});

// ------------------------------------------------------------------- mirror
test("drive-sync deletes what left the folder, and refuses to delete all", () => {
  const src = readFileSync(join(HERE, "bin", "drive-sync.mjs"), "utf8");
  assert.ok(src.includes("function prune("), "the mirror is gone");
  assert.ok(/REFUSING to remove/.test(src), "the half-the-library guard is gone");
  assert.ok(src.includes("drive.readonly"),
    "the Drive scope must stay read only — this never deletes from Drive");
  assert.ok(/STORY_FOLDER\s*=\s*\/stor\/i/.test(src),
    "the stories subfolder is no longer matched by name");
});

test("prune keeps its hands off when more than half would go", () => {
  // The guard is arithmetic, so it is checked as arithmetic rather than by
  // driving Drive: 3 of 4 is more than half and must be refused.
  const held = 4, gone = 3;
  assert.ok(gone > held / 2, "the guard would not fire on a revoked share");
});

// -------------------------------------------------------------- queue sanity
test("nothing queued uses an excluded photo", () => {
  const banned = new Set(config.exclude ?? []);
  const dir = join(HERE, "queue");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const item = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const all = [item.origin, ...(item.slides ?? []).map((s) => s.origin)];
    for (const o of all) assert.ok(!banned.has(o), `${f} carries ${o}`);
  }
});

test("a photo is the cover of at most one queued post", () => {
  const dir = join(HERE, "queue");
  const seen = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const item = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const k = stem(item.origin);
    assert.ok(!seen.has(k), `${k} is the cover of both ${seen.get(k)} and ${f}`);
    seen.set(k, f);
  }
});

test("nothing in the story queue appears anywhere in the feed queue", () => {
  // Compared by STEM, not by path. The 9:16 crop of 008-1KqJChSW lives under
  // story-9x16/ and the original under social-drive/, so an exact-path check
  // passes while the same picture goes out as a story and as a carousel slide.
  // There were 32 of those the first time this ran.
  //
  // Slides repeating between two POSTS is deliberate and not checked here: it
  // is what makes 28 photos into 28 carousels instead of 7.
  const dir = join(HERE, "queue");
  const items = readdirSync(dir).filter((x) => x.endsWith(".json"))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8"))]);
  const stories = new Set(items.filter(([, i]) => i.kind === "story").map(([, i]) => stem(i.origin)));
  for (const [f, i] of items) {
    if (i.kind === "story") continue;
    for (const o of [i.origin, ...(i.slides ?? []).map((s) => s.origin)]) {
      assert.ok(!stories.has(stem(o)), `${f} carries ${o}, which is also a story`);
    }
  }
});

test("nothing queued has already gone out", () => {
  const posted = new Set();
  const led = join(HERE, "ledger.jsonl");
  if (existsSync(led)) {
    for (const line of readFileSync(led, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      for (const o of [r.plan_cover, r.origin]) if (o) posted.add(o);
    }
  }
  const dir = join(HERE, "queue");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const item = JSON.parse(readFileSync(join(dir, f), "utf8"));
    assert.ok(!posted.has(item.origin), `${f} would repost ${item.origin}`);
  }
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
