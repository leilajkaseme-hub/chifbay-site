#!/usr/bin/env node
// seo-captions.mjs — put the place and the service into the first sentence of every caption that
// is still waiting (queue/*.json, and the Reels that are not posted yet), so Instagram search,
// Google and AI answers can read what the post is about. Posts already online are never touched.
//
//   node bin/seo-captions.mjs           show what would change
//   node bin/seo-captions.mjs --write   change it
//
// Safe to run again: a caption that already names Madeira or Funchal early is left alone
// (see lib/seo.mjs). New captions get the same treatment when they are written (lib/caption.mjs).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readLedger } from "../lib/queue.mjs";
import { withLead } from "../lib/seo.mjs";

const WRITE = process.argv.includes("--write");
const posted = new Set(readLedger().filter((e) => e.ok && e.id).map((e) => e.id));
const render = (text, tags) => (tags?.length ? `${text.trim()}\n\n${tags.join(" ")}` : text.trim());
let changed = 0;

for (const f of readdirSync(join(ROOT, "queue")).filter((n) => n.endsWith(".json"))) {
  const path = join(ROOT, "queue", f);
  const item = JSON.parse(readFileSync(path, "utf8"));
  if (item.kind === "story" || !item.caption || posted.has(item.id)) continue;
  const next = withLead(item.caption, item);
  if (next === item.caption.trim()) continue;
  console.log(`${item.id}: + "${next.split("\n")[0]}"`);
  if (WRITE) {
    item.caption = next;
    item.rendered_caption = render(next, item.hashtags);
    writeFileSync(path, JSON.stringify(item, null, 2) + "\n");
  }
  changed++;
}

// Reels: ig-auto/reels-plan.json is what the robot reads; stores/chifbay/reels/reels.json is the source
// that make.py rebuilds it from (it exists on the MacBook, not in the public repo).
const source = join(ROOT, "..", "..", "reels", "reels.json");
for (const [file, key] of [[join(ROOT, "reels-plan.json"), "reels"], [source, "reels"]]) {
  if (!existsSync(file)) continue;
  const doc = JSON.parse(readFileSync(file, "utf8"));
  let touched = false;
  for (const r of doc[key] ?? []) {
    if (r.retired || r.test || posted.has(r.id) || !r.caption) continue;
    const next = withLead(r.caption, { id: r.id, subject: r.subject, angle: r.subject });
    if (next === r.caption.trim()) continue;
    console.log(`${r.id} (${file.endsWith("reels-plan.json") ? "plan" : "source"}): + "${next.split("\n")[0]}"`);
    if (WRITE) r.caption = next;
    touched = true;
    changed++;
  }
  if (WRITE && touched) writeFileSync(file, JSON.stringify(doc, null, file === source ? 1 : 2) + "\n");
}
console.log(changed ? `${changed} caption(s) ${WRITE ? "changed" : "would change (add --write)"}` : "every waiting caption already names the place");
