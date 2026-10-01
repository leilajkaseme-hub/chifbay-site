#!/usr/bin/env node
// add-tide.mjs: puts the "tide" design layer on every site page.
//
//   node scripts/add-tide.mjs           dry run, prints what would change
//   node scripts/add-tide.mjs --write   applies it
//   node scripts/add-tide.mjs --undo    removes the layer and the new head snippet
//
// What it does, per page that loads the shared peak layer:
//   1. The blocking <head> snippet (marked /*theme*/) becomes the new one:
//      light is the default theme, and it puts up the page transition cover
//      before the first paint when the visitor arrived through it.
//      Pages that had no snippet (the three booking pages, 404) get one.
//   2. <link rel="stylesheet" href="/tide.min.css"> goes last in <head>, so it
//      wins over peak, atlas, motion and booking.
//   3. <script src="/tide.min.js" defer> goes before </body>.
// Safe to run again: nothing is doubled. Partner landing pages (their own
// design, no peak.css) are left alone.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const UNDO = process.argv.includes("--undo");
const SKIP_DIRS = new Set(["node_modules", "vendor", "ig-auto", "scripts", "assets", "data", "social-drive", "social", "ig", "zz-test", "print", "story-9x16", ".git", ".github"]);

export const SNIPPET = `<script>/*theme*/(function(){var d=document.documentElement;try{var t=localStorage.getItem('cb-theme2');if(t!=='light'&&t!=='dark')t='light';d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','light')}try{var x=JSON.parse(sessionStorage.getItem('cb-tx')||'null'),n=function(p){return p.replace(/(index)?(\\.html)?\\/?$/,'')||'/'};if(x&&Date.now()-x.t<6000&&n(String(x.u).split('?')[0])===n(location.pathname)){d.classList.add('cbtx');d.style.setProperty('--txp','"'+(x.p|0)+'%"')}}catch(e){}})();</script>`;
const OLD_SNIPPET = /<script>\/\*theme\*\/[\s\S]*?<\/script>/;
const CSS = `<link rel="stylesheet" href="/tide.min.css"/>`;
const JS = `<script src="/tide.min.js" defer></script>`;

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
    if (OLD_SNIPPET.test(h)) h = h.replace(OLD_SNIPPET, SNIPPET);
    else h = h.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n${SNIPPET}`);
    if (!h.includes(CSS)) h = h.replace(/<\/head>/i, `${CSS}\n</head>`);
    if (!h.includes(JS)) h = h.replace(/<\/body>/i, `${JS}\n</body>`);
  }
  if (h !== before) { changed++; if (WRITE || UNDO) writeFileSync(abs, h); }
}
console.log(`${WRITE || UNDO ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s) changed, ${skipped.length} without peak.css left alone`);
if (process.argv.includes("-v")) console.log(skipped.join("\n"));
