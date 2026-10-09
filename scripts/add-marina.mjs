#!/usr/bin/env node
// add-marina.mjs: puts the "Marina" layer (type, colours, Motion effects) on every site page.
//
//   node scripts/add-marina.mjs           dry run, prints what would change
//   node scripts/add-marina.mjs --write   applies it
//   node scripts/add-marina.mjs --undo    removes the layer (Satoshi stays removed)
//
// Per page that loads the shared peak layer:
//   1. <link rel="stylesheet" href="/marina.min.css"> goes last in <head>, after tide.
//   2. Motion (self hosted, vendor/motion) then /marina.min.js go before </body>, deferred.
//   3. The Fontshare links (Satoshi) go: marina.css sets every title in DM Serif
//      Display and the rest in Inter, so Satoshi is never used any more.
// Safe to run again: nothing is doubled. Build the min files first:
//   npx esbuild marina.js --minify --outfile=marina.min.js
//   npx esbuild marina.css --minify --outfile=marina.min.css
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const UNDO = process.argv.includes("--undo");
const SKIP_DIRS = new Set(["node_modules", "vendor", "ig-auto", "scripts", "assets", "data", "social-drive", "social", "ig", "zz-test", "print", "story-9x16", "journal-queue", ".git", ".github"]);

const CSS = `<link rel="stylesheet" href="/marina.min.css"/>`;
const JS = `<script src="/vendor/motion/motion-11.18.2.min.js" defer></script>\n<script src="/marina.min.js" defer></script>`;
const FONTSHARE = /[ \t]*<link[^>]+(api|cdn)\.fontshare\.com[^>]*>\s*\n?/g;

function pages() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(SITE, dir), { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".html")) out.push(rel);
    }
  };
  walk("");
  return out;
}

let changed = 0, skipped = [];
for (const rel of pages()) {
  const abs = join(SITE, rel);
  const before = readFileSync(abs, "utf8");
  if (!/peak(\.min)?\.css/.test(before)) { skipped.push(rel); continue; }
  let h = before;
  if (UNDO) {
    h = h.replace(`\n${CSS}`, "").replace(CSS, "").replace(`\n${JS}`, "").replace(JS, "");
  } else {
    h = h.replace(FONTSHARE, "");
    if (!h.includes(CSS)) h = h.replace(/<\/head>/i, `${CSS}\n</head>`);
    if (!h.includes(JS)) h = h.replace(/<\/body>/i, `${JS}\n</body>`);
  }
  if (h !== before) { changed++; if (WRITE || UNDO) writeFileSync(abs, h); }
}
console.log(`${WRITE || UNDO ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s) changed, ${skipped.length} without peak.css left alone`);
if (process.argv.includes("-v")) console.log(skipped.join("\n"));
