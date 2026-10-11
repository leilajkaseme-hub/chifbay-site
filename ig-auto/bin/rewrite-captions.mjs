#!/usr/bin/env node
// rewrite-captions.mjs — write the captions that are still waiting again, in the current voice
// (long, teasing, place and service in the first line: lib/tone.mjs, lib/caption.mjs).
//
//   node bin/rewrite-captions.mjs            show what would be written (calls Claude, changes nothing)
//   node bin/rewrite-captions.mjs --write    change the queue items and the waiting Reels
//
// Posts already online are never touched. Needs the `claude` command (Claude Code) on this machine.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE_ROOT, brand, readLedger, recentPosts } from "../lib/queue.mjs";
import { pickAngle, render, writeCaption } from "../lib/caption.mjs";
import { angleOf as angleOfPost } from "../lib/seo.mjs";

const WRITE = process.argv.includes("--write");
const posted = new Set(readLedger().filter((e) => e.ok && e.id).map((e) => e.id));
const recent = recentPosts(30);
const angleOf = (k) => brand.angles.find((a) => a.key === k) ?? pickAngle(recent);

function rewrite(label, imagePath, angleKey, source) {
  const c = writeCaption({ imagePath, angleHint: angleOf(angleKey), recent, source });
  console.log(`\n=== ${label} [${c.writer}] ${c.text.length} chars\n${c.text}`);
  if (c.writer !== "claude") return null; // the plain template is not an improvement: keep what is there
  recent.unshift({ angle: c.angle, caption: c.text, hashtags: c.hashtags });
  return c;
}

for (const f of readdirSync(join(ROOT, "queue")).filter((n) => n.endsWith(".json"))) {
  const path = join(ROOT, "queue", f);
  const item = JSON.parse(readFileSync(path, "utf8"));
  if (item.kind === "story" || posted.has(item.id) || !item.slides?.[0]?.image) continue;
  const c = rewrite(item.id, join(SITE_ROOT, item.slides[0].image), item.angle, item.source === "video" ? "video" : "library");
  if (c && WRITE) {
    Object.assign(item, { caption: c.text, hashtags: c.hashtags, angle: c.angle, writer: "claude", rendered_caption: render(c) });
    writeFileSync(path, JSON.stringify(item, null, 2) + "\n");
  }
}

// Reels still to come: the plan the robot reads, and the MacBook source it is rebuilt from.
const plan = join(ROOT, "reels-plan.json");
const source = join(ROOT, "..", "..", "reels", "reels.json");
const docs = [plan, source].filter(existsSync).map((file) => ({ file, doc: JSON.parse(readFileSync(file, "utf8")) }));
const first = docs[0];
for (const r of first?.doc.reels ?? []) {
  if (r.retired || r.test || posted.has(r.id) || !r.caption) continue;
  const cover = r.clean_cover ? join(SITE_ROOT, r.clean_cover.replace(/^https?:\/\/(?:www\.)?chifbay\.com\//, "")) : null;
  if (!cover || !existsSync(cover)) { console.log(`${r.id}: no cover picture, skipped`); continue; }
  const c = rewrite(r.id, cover, angleOfPost(r), "video");
  if (c && WRITE) for (const d of docs) for (const x of d.doc.reels ?? []) if (x.id === r.id) x.caption = c.text;
}
if (WRITE) for (const d of docs) writeFileSync(d.file, JSON.stringify(d.doc, null, d.file === source ? 1 : 2) + "\n");
console.log(WRITE ? "\nwritten" : "\n(nothing changed: add --write)");
