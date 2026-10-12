#!/usr/bin/env node
// test-journal.mjs: the publisher run for real on a copy of the site, with fake queued posts.
//   node scripts/journal/test-journal.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, seoFile } from "./lib.mjs";
import { eventBrief, eventsFor } from "./events.mjs";

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
  assert.ok(html.includes("background-image:url('../assets/journal/hero-alt-madeira.jpg')"), "hero named after its alt");
  assert.ok(html.includes('content="https://chifbay.com/assets/journal/hero-alt-madeira.jpg"'), "share image");
  assert.ok(html.includes("assets/journal/inside-one-madeira.jpg") && html.includes("assets/journal/inside-two-madeira.jpg"), "two photos in the body");
  const p = JSON.parse(readFileSync(join(dir, "posts/posts.json"), "utf8"))[0];
  assert.equal(p.slug, "newer-with-photos"); assert.equal(p.date, "2026-10-20");
  assert.equal(p.heroImage, "assets/journal/hero-alt-madeira.jpg"); assert.equal(p.heroAlt, "Hero alt");
  assert.ok(!("images" in p) && !("written" in p) && !("queued" in p) && !("photo" in p), "queue fields stripped");
  assert.ok(existsSync(join(dir, "assets/journal/inside-two-madeira.jpg")));
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

check("seoFile: plain words, madeira last, no clashes", () => {
  assert.equal(seoFile("A Café table at the Mercado dos Lavradores, Funchal"), "cafe-table-mercado-dos-lavradores-funchal-madeira");
  assert.equal(seoFile("Hero", ["hero-madeira"]), "hero-madeira-2");
  assert.equal(seoFile("", []), "madeira");
});

check("a hero already made by ChatGPT (photo: chatgpt) keeps its file and does not ask for new photos", (dir) => {
  const q = queue(dir, "has-hero");
  const m = JSON.parse(readFileSync(join(q, "meta.json"), "utf8")); m.photo = "chatgpt";
  writeFileSync(join(q, "meta.json"), JSON.stringify(m));
  const r = run(dir, "2026-10-20");
  assert.match(r.stdout, /PUBLISHED has-hero/);
  assert.equal(JSON.parse(readFileSync(join(dir, "posts/posts.json"), "utf8"))[0].heroImage, model.heroImage);
});

check("a hero file that does not exist yet is swapped for a spare photo, never left broken", (dir) => {
  const q = queue(dir, "ghost-hero");
  const m = JSON.parse(readFileSync(join(q, "meta.json"), "utf8")); m.heroImage = "assets/journal/ghost-hero-hero.jpg";
  writeFileSync(join(q, "meta.json"), JSON.stringify(m));
  writeFileSync(join(q, "post.draft"), readFileSync(join(q, "post.draft"), "utf8").replace(model.heroImage.replace(/\.\w+$/, ""), "assets/journal/ghost-hero-hero"));
  mkdirSync(join(dir, "assets/journal"), { recursive: true });
  cpSync(join(ROOT, "assets/journal/boat-deck-horizon-ginger-calm-sea-madeira.jpg"), join(dir, "assets/journal/boat-deck-horizon-ginger-calm-sea-madeira.jpg"));
  const r = run(dir, "2026-10-20");
  assert.match(r.stdout, /PUBLISHED ghost-hero/);
  assert.equal(JSON.parse(readFileSync(join(dir, "posts/posts.json"), "utf8"))[0].heroImage, "assets/journal/boat-deck-horizon-ginger-calm-sea-madeira.jpg");
  assert.ok(!readFileSync(join(dir, "posts/ghost-hero.html"), "utf8").includes("ghost-hero-hero"));
});

check("events: the Flower Festival guide is due 10 to 18 days before, once", () => {
  assert.equal(eventsFor("2027-04-05").length, 0, "24 days out: too early");
  assert.equal(eventsFor("2027-04-15")[0].id, "flower-festival-2027");
  assert.equal(eventsFor("2027-04-25").length, 0, "4 days out: too late");
  assert.equal(eventsFor("2026-10-20").length, 0, "a quiet day has no event");
  assert.match(eventBrief("2027-04-15"), /Timed post.*Flower Festival.*14 days/s);
  assert.equal(eventBrief("2027-04-15", ["Madeira Flower Festival 2027: dates and parades"]), "", "already covered: no second one");
  assert.equal(eventsFor("2026-12-20")[0].id, "new-year-fireworks-2026");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
