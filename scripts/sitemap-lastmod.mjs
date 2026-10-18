#!/usr/bin/env node
// sitemap-lastmod.mjs: gives every sitemap address a <lastmod>, read from the page itself (the latest
// "dateModified" in its JSON-LD), so Google knows which pages changed and comes back to them first
// (18 Oct 2026: Google had never crawled /sunset-cruise, the address the page declares as its main one).
// No date in the page = no lastmod (a made-up date is worse than none). Safe to run again.
//   node scripts/sitemap-lastmod.mjs           dry run
//   node scripts/sitemap-lastmod.mjs --write
// Run after anything that rewrites the sitemap (blog-auto, posts-i18n, posts-native do it).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const file = path.join(ROOT, "sitemap.xml");
const xml = fs.readFileSync(file, "utf8");

function pageFile(loc) {
  const rel = loc.replace(/^https:\/\/chifbay\.com\/?/, "").split(/[?#]/)[0];
  const cands = rel === "" || rel.endsWith("/") ? [`${rel}index.html`] : [rel, `${rel}.html`, `${rel}/index.html`];
  return cands.map((c) => path.join(ROOT, c)).find((p) => fs.existsSync(p) && fs.statSync(p).isFile() && p.endsWith(".html"));
}
function modified(html) {
  const dates = [...html.matchAll(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort();
  return dates.at(-1) || null;
}

let set = 0, missing = 0;
const out = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>[^<]*<\/lastmod>)?/g, (m, loc) => {
  const f = pageFile(loc.trim());
  const d = f && modified(fs.readFileSync(f, "utf8"));
  if (!d) { missing++; return m; }
  set++;
  return `<url><loc>${loc}</loc><lastmod>${d}</lastmod>`;
});
console.log(`${set} address(es) with a date from the page, ${missing} without one`);
if (out !== xml) { console.log(WRITE ? "sitemap.xml written" : "DRY RUN (add --write)"); if (WRITE) fs.writeFileSync(file, out); }
else console.log("no change");
