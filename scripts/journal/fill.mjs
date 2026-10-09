#!/usr/bin/env node
// fill.mjs: write Journal posts ahead of time into journal-queue/ (see lib.mjs).
//
//   node scripts/journal/fill.mjs [--target 14] [--max 2] [--today]
//
// --today: the first post is dated today (the publisher's last resort when the queue is empty).
//
// Writes at most --max posts per run (default 2), until the queue holds --target posts
// (default 14, two weeks). Two a day is gentle on the Claude plan this runs on (the same
// weekly limit as Theo's own sessions) and still grows the queue by one a day, since one
// leaves daily. If Claude is out for a week, the queue covers it.
//
// Each post is written by the same instructions as before (scripts/blog-local/BLOG-INSTRUCTIONS.md),
// told its publication date, and told every queued title so it never repeats one. Then the
// files it wrote are moved into the queue and posts.json / sitemap.xml are put back.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { POSTS_JSON, QUEUE, ROOT, ntfy, queueItems, readPosts, today } from "./lib.mjs";

const arg = (k, d) => (process.argv.includes(k) ? Number(process.argv[process.argv.indexOf(k) + 1]) : d);
const TARGET = arg("--target", 14);
const MAX = arg("--max", 2);
const SITEMAP = join(ROOT, "sitemap.xml");
const IMAGES_FILE = join(ROOT, "journal-images.json");

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function preface(day) {
  return `# Queue mode (read first)
This post is written ahead of time. It goes live on **${day}**.
- Wherever the steps below say "today" or ask you to run \`date\`, use ${day} instead. Every date in
  the post (meta, JSON-LD, the date under the title) is ${day}.
- Anything time-bound (events, openings, seasons, "this week") must still be true and upcoming on ${day}.
  For a What's On post, only events that happen after ${day}.
- After step 9, also write \`journal-images.json\` at the repository root: a JSON array of exactly 3
  objects \`{"prompt": "...", "alt": "..."}\`, the photos for this article: [0] the hero, wide
  landscape; [1] and [2] two different scenes for inside the article. Each prompt is one or two
  sentences describing a real-looking photograph of the actual place, food or scene in Madeira that
  the article talks about (subject, place, light, viewpoint). No text, no logos, no brand names. If a
  boat appears it is a small white private motorboat, never a big yacht. "alt" is a short plain
  description of that photo for the page.

`;
}

function restore(posts, sitemap) {
  writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2) + "\n");
  writeFileSync(SITEMAP, sitemap);
  rmSync(IMAGES_FILE, { force: true });
}

function images(entry) {
  try {
    const list = JSON.parse(readFileSync(IMAGES_FILE, "utf8"));
    if (Array.isArray(list) && list.length >= 3 && list.slice(0, 3).every((x) => x?.prompt && x?.alt)) {
      return list.slice(0, 3).map((x) => ({ prompt: String(x.prompt).slice(0, 600), alt: String(x.alt).slice(0, 160) }));
    }
  } catch {}
  return [
    { prompt: `${entry.title}: ${entry.description}`, alt: entry.heroAlt || entry.title },
    { prompt: `A wide view of the place described in this article: ${entry.title}`, alt: entry.title },
    { prompt: `A close detail scene from this article: ${entry.title}`, alt: entry.title },
  ];
}

/** One post, or a reason it could not be written. */
function writeOne(day) {
  const posts = readPosts();
  const sitemap = readFileSync(SITEMAP, "utf8");
  const queued = queueItems();
  // Claude reads posts.json to avoid repeats: show it the queued posts as well.
  writeFileSync(POSTS_JSON, JSON.stringify([...queued.map((q) => ({ ...q.meta, date: day })), ...posts], null, 2) + "\n");
  const known = new Set([...posts, ...queued.map((q) => q.meta)].map((p) => p.slug));

  const prompt = preface(day) + readFileSync(join(ROOT, "scripts/blog-local/BLOG-INSTRUCTIONS.md"), "utf8");
  const run = spawnSync("claude", ["-p", prompt, "--permission-mode", "acceptEdits",
    "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
  { cwd: ROOT, encoding: "utf8", timeout: 20 * 60_000, maxBuffer: 20 * 1024 * 1024 });
  const out = `${run.stdout || ""}${run.stderr || ""}`.trim();

  let wrote;
  try { wrote = readPosts().find((p) => !known.has(p.slug)); } catch { wrote = null; }
  const file = wrote && join(ROOT, "posts", `${wrote.slug}.html`);
  const problem = run.status !== 0 ? `claude stopped: ${out.split("\n").slice(-2).join(" ").slice(0, 300)}`
    : !wrote ? `claude wrote no new posts.json entry (${out.slice(-200)})`
    : !existsSync(file) ? `no posts/${wrote.slug}.html`
    : null;
  if (problem) {
    if (wrote && existsSync(file)) rmSync(file);
    restore(posts, sitemap);
    return { problem, limit: /limit|rate|quota|usage/i.test(out) };
  }
  const html = readFileSync(file, "utf8");
  const words = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").split(/\s+/).length;
  const bad = !html.includes(`/posts/${wrote.slug}`) ? "the page does not carry its canonical URL"
    : !html.includes(day) ? `the page does not carry the date ${day}`
    : words < 650 ? `only ${words} words on the page`
    : /[–—]/.test(`${wrote.title} ${wrote.description}`) ? "a long dash in the title or description"
    : null;
  if (bad) { rmSync(file); restore(posts, sitemap); return { problem: `${wrote.slug}: ${bad}` }; }

  const dir = join(QUEUE, wrote.slug);
  mkdirSync(dir, { recursive: true });
  renameSync(file, join(dir, "post.draft"));
  const meta = { ...wrote, written: day, queued: new Date().toISOString(), images: images(wrote) };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  restore(posts, sitemap);
  return { slug: wrote.slug, title: wrote.title };
}

let made = 0;
const failures = [];
while (made + failures.length < MAX) {
  const have = queueItems().length;
  if (have >= TARGET) break;
  // The queue posts one a day, starting tomorrow (or today, for the publisher's last resort).
  const day = process.argv.includes("--today") && made === 0 ? today() : addDays(today(), have + 1);
  const r = writeOne(day);
  if (r.slug) { made++; console.log(`QUEUED ${r.slug} for about ${day}: ${r.title}`); continue; }
  failures.push(r.problem);
  console.log(`not written: ${r.problem}`);
  if (r.limit) break; // the plan is at its limit: the next run tries again
}
const left = queueItems().length;
console.log(`queue: ${left} post(s) (${queueItems().filter((i) => i.images).length} with their ChatGPT photos)`);
if (left < 5) {
  await ntfy("CHIFBAY Journal queue is low", `Only ${left} post(s) written ahead. Last problem: ${failures.at(-1) || "none"}`, "high");
}
// A failed write is not a failed day: the queue still publishes. Only an empty queue is red.
process.exit(left === 0 && made === 0 ? 1 : 0);
