#!/usr/bin/env node
// mini-images.mjs: ChatGPT photos for the queued Journal posts. Runs on the Mac mini only
// (ChatGPT image jobs never run on the MacBook), from a small clone of chifbay-site:
//
//   ~/repos/chifbay-site   partial clone, sparse: journal-queue/ and scripts/journal/ only
//   node scripts/journal/mini-images.mjs [--max 6] [--account 1] [--no-push]
//
// --no-push: make and place the photos, commit nothing (a test run).
//
// For each queued post without its three photos (meta.json "images": the hero and two
// scenes, written with the article), asks ChatGPT through the same tool and Chrome profiles
// as the other image jobs (pale-youth-video/stills.mjs), resizes them (hero 1600x900, inside
// 1200x800, JPEG), commits and pushes. Oldest posts first, at most --max posts a run, so a
// day's ChatGPT allowance is never used up by one job. Run twice a day by launchd
// (com.theo.journal-images); a post that misses its photos still publishes with a real
// library photo, so this job can be late without costing a day.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { QUEUE, ROOT, IMAGE_NAMES, queueItems } from "./lib.mjs";

const STILLS_DIR = "/Users/Shared/Claude/stores/_forge/marketing/pale-youth-video";
const WORK = join(process.env.HOME, "journal-images-work");
const MAX = process.argv.includes("--max") ? Number(process.argv[process.argv.indexOf("--max") + 1]) : 6;
const ACCOUNT = process.argv.includes("--account") ? process.argv[process.argv.indexOf("--account") + 1] : "1";
const SIZE = { hero: [1600, 900], "inline-1": [1200, 800], "inline-2": [1200, 800] };
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);

const STYLE = "A real photograph, as taken by a professional travel photographer on assignment in Madeira, Portugal: " +
  "natural light, true colours, sharp detail, natural film-like texture, nothing staged. Not a painting, not CGI, " +
  "no HDR glow, no over-saturation. No text, no captions, no logos, no watermarks, no brand names anywhere. " +
  "Any people are ordinary visitors seen from a distance or from behind, never posing for the camera. " +
  "If a boat appears, it is a small white private motorboat with one outboard engine, never a large yacht. " +
  "Landscape 3:2.";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

function sync() {
  git("fetch", "-q", "origin", "main");
  git("reset", "-q", "--hard", "origin/main");
}

/** ChatGPT PNG -> JPEG at the size the page uses, centre crop. */
function fit(png, jpg, [w, h]) {
  const [pw, ph] = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", png], { encoding: "utf8" })
    .match(/\d+/g).slice(-2).map(Number);
  const scale = Math.max(w / pw, h / ph);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82",
    "-z", String(Math.ceil(ph * scale)), String(Math.ceil(pw * scale)), png, "--out", jpg], { stdio: "ignore" });
  execFileSync("sips", ["-c", String(h), String(w), jpg], { stdio: "ignore" });
}

function push(msg) {
  if (process.argv.includes("--no-push")) { log(`--no-push: not pushed (${msg})`); return false; }
  git("add", "-A", "journal-queue");
  if (!git("status", "--porcelain", "journal-queue")) return false;
  git("commit", "-q", "-m", msg);
  for (let i = 0; i < 4; i++) {
    try { git("pull", "-q", "--rebase", "origin", "main"); git("push", "-q", "origin", "HEAD:main"); return true; }
    catch (e) { log(`push try ${i + 1} failed: ${String(e.message).split("\n")[0]}`); }
  }
  throw new Error("could not push the photos");
}

sync();
const todo = queueItems().filter((i) => !i.images).slice(0, MAX);
log(`${queueItems().length} queued, ${todo.length} to illustrate now`);
for (const item of todo) {
  const work = join(WORK, item.slug);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const shots = (item.meta.images || []).slice(0, 3);
  if (shots.length < 3) { log(`${item.slug}: fewer than 3 photo descriptions, skipped`); continue; }
  writeFileSync(join(work, "stills.json"), JSON.stringify(IMAGE_NAMES.map((name, i) => ({
    name, prompt: `${shots[i].prompt}\n\n${STYLE}`,
  })), null, 1));
  // stills.mjs joins its argument onto its own folder, so it gets a relative path.
  const r = spawnSync(process.execPath, ["stills.mjs", relative(STILLS_DIR, work), "--account", ACCOUNT],
    { cwd: STILLS_DIR, stdio: "inherit", timeout: 40 * 60_000 });
  const made = IMAGE_NAMES.filter((n) => existsSync(join(work, "stills", `${n}.png`)) && statSync(join(work, "stills", `${n}.png`)).size > 100_000);
  if (made.length < 3) { log(`${item.slug}: ChatGPT gave ${made.length}/3 photos (exit ${r.status}), next run tries again`); if (r.status) break; continue; }
  if (!process.argv.includes("--no-push")) sync(); // the queue may have moved while ChatGPT worked
  const dir = join(QUEUE, item.slug);
  if (!existsSync(dir)) { log(`${item.slug}: already published, photos not needed`); continue; }
  for (const n of IMAGE_NAMES) fit(join(work, "stills", `${n}.png`), join(dir, `${n}.jpg`), SIZE[n]);
  push(`Journal queue: ChatGPT photos for ${item.slug}`);
  log(`${item.slug}: 3 photos pushed`);
  rmSync(work, { recursive: true, force: true });
}
