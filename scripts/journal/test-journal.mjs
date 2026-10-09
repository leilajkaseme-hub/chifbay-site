#!/usr/bin/env node
// test-journal.mjs: the publisher run for real on a copy of the site, with fake queued posts.
//   node scripts/journal/test-journal.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const posts = JSON.parse(readFileSync(join(ROOT, "posts/posts.json"), "utf8"));
const model = posts[0];
const modelHtml = readFileSync(join(ROOT, "posts", `${model.slug}.html`), "utf8");
let passed = 0, failed = 0;

function site() {
  const dir = mkdtempSync(join(tmpdir(), "journal-"));
  cpSync(join(ROOT, "scripts/journal"), join(dir, "scripts/journal"), { recursive: true });
  mkdirSync(join(dir, "posts"));
  writeFileSync(join(dir, "posts/posts.json"), JSON.stringify(posts.slice(1), null, 2));
  cpSync(join(ROOT, "sitemap.xml"), join(dir, "sitemap.xml"));
  return dir;
}

/** A queued post made from the latest real article, renamed. */
function queue(dir, slug, { queued = "2026-10-01T00:00:00Z", photos = false } = {}) {
  const q = join(dir, "journal-queue", slug);
  mkdirSync(q, { recursive: true });
  writeFileSync(join(q, "post.draft"), modelHtml.split(model.slug).join(slug));
  writeFileSync(join(q, "meta.json"), JSON.stringify({ ...model, slug, written: model.date, queued,
    images: [{ prompt: "p", alt: "Hero alt" }, { prompt: "p", alt: "Inside one" }, { prompt: "p", alt: "Inside two" }] }));
  if (photos) for (const n of ["hero", "inline-1", "inline-2"]) writeFileSync(join(q, `${n}.jpg`), "jpg");
  return q;
}

const run = (dir, day) => spawnSync(process.execPath, ["scripts/journal/publish.mjs"], {
  cwd: dir, encoding: "utf8", env: { ...process.env, JOURNAL_TODAY: day } });

function check(name, fn) {
  const dir = site();
  try { fn(dir); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message.split("\n")[0]}`); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log("Journal publisher, on a copy of the site");

check("publishes the post that has its photos, dated today, photos wired in", (dir) => {
  queue(dir, "older-no-photos", { queued: "2026-10-01T00:00:00Z" });
  queue(dir, "newer-with-photos", { queued: "2026-10-02T00:00:00Z", photos: true });
  const r = run(dir, "2026-10-20");
  assert.match(r.stdout, /PUBLISHED newer-with-photos \(ChatGPT photos\)/);
  const html = readFileSync(join(dir, "posts/newer-with-photos.html"), "utf8");
  assert.ok(html.includes("2026-10-20") && html.includes("20 October 2026"), "date changed");
  assert.ok(!html.includes(model.date), "old date gone");
  assert.ok(html.includes("background-image:url('../assets/journal/newer-with-photos-hero.jpg')"));
  assert.ok(html.includes('content="https://chifbay.com/assets/journal/newer-with-photos-hero.jpg"'), "share image");
  assert.equal((html.match(/newer-with-photos-inline-/g) || []).length, 2, "two photos in the body");
  const p = JSON.parse(readFileSync(join(dir, "posts/posts.json"), "utf8"))[0];
  assert.equal(p.slug, "newer-with-photos"); assert.equal(p.date, "2026-10-20");
  assert.equal(p.heroImage, "assets/journal/newer-with-photos-hero.jpg"); assert.equal(p.heroAlt, "Hero alt");
  assert.ok(!("images" in p) && !("written" in p) && !("queued" in p), "queue fields stripped");
  assert.ok(existsSync(join(dir, "assets/journal/newer-with-photos-inline-2.jpg")));
  assert.ok(readFileSync(join(dir, "sitemap.xml"), "utf8").includes("<loc>https://chifbay.com/posts/newer-with-photos</loc>"));
  assert.ok(!existsSync(join(dir, "journal-queue/newer-with-photos")), "queue folder removed");
  assert.ok(existsSync(join(dir, "journal-queue/older-no-photos")), "the other stays queued");
});

check("a second run the same day publishes nothing", (dir) => {
  queue(dir, "a"); queue(dir, "b", { queued: "2026-10-03T00:00:00Z" });
  run(dir, "2026-10-20");
  const r = run(dir, "2026-10-20");
  assert.match(r.stdout, /^ALREADY a/);
  assert.ok(existsSync(join(dir, "journal-queue/b")));
  assert.match(run(dir, "2026-10-21").stdout, /PUBLISHED b/);
});

check("no photos yet: still publishes, keeps the library photo", (dir) => {
  queue(dir, "plain");
  const r = run(dir, "2026-10-20");
  assert.match(r.stdout, /PUBLISHED plain \(no ChatGPT photos yet\)/);
  const p = JSON.parse(readFileSync(join(dir, "posts/posts.json"), "utf8"))[0];
  assert.equal(p.heroImage, model.heroImage);
});

check("empty queue says EMPTY, changes nothing", (dir) => {
  const before = readFileSync(join(dir, "posts/posts.json"), "utf8");
  assert.match(run(dir, "2026-10-20").stdout, /^EMPTY/);
  assert.equal(readFileSync(join(dir, "posts/posts.json"), "utf8"), before);
});

check("a queued slug that is already live is never published twice", (dir) => {
  queue(dir, posts[1].slug);
  assert.match(run(dir, "2026-10-20").stdout, /^EMPTY/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
