#!/usr/bin/env node
// add-nye-offer.mjs: the "31 Dec 2026, New Year's Eve fireworks from the water"
// strip on the home page and the experiences page, in the 6 languages, plus
// the 6 New Year's Eve pages in the sitemap.
//
//   node scripts/add-nye-offer.mjs            dry run
//   node scripts/add-nye-offer.mjs --write    add or refresh the strip
//   node scripts/add-nye-offer.mjs --remove --write   take it off (after the night)
//
// The strip also hides itself in the browser from 1 Jan 2027 01:00 UTC, so a
// forgotten one never sells a night that is over. Safe to run again.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nyeRibbon, NYE_LANGS, NYE } from "./data/nye-2026.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const REMOVE = process.argv.includes("--remove");
const BLOCK = /\n?<!-- nye-offer -->[\s\S]*?<!-- \/nye-offer -->\n?/;

let changed = 0;
for (const lang of NYE_LANGS()) {
  const pre = lang === "en" ? "" : `${lang}/`;
  const spots = [
    // home: right under the hero
    [`${pre}index.html`, /<\/header>\n/, (m, r) => `${m}${r}\n`],
    // experiences: above the day / sunset comparison
    [`${pre}experiences.html`, /([ \t]*)<!-- tide:compare -->/, (m, r) => `${r}\n${m}`],
  ];
  for (const [rel, anchor, put] of spots) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.log(`skip (missing): ${rel}`); continue; }
    const before = fs.readFileSync(file, "utf8");
    let html = before.replace(BLOCK, "\n");
    if (!REMOVE) {
      if (!anchor.test(html)) throw new Error(`${rel}: anchor not found, strip not placed`);
      html = html.replace(anchor, (m) => put(m, nyeRibbon(lang)));
    }
    if (html === before) continue;
    changed++;
    console.log(`${REMOVE ? "remove" : "update"}: ${rel}`);
    if (WRITE) fs.writeFileSync(file, html);
  }
}

// sitemap: one entry per language, extensionless like the rest
const sm = path.join(ROOT, "sitemap.xml");
let xml = fs.readFileSync(sm, "utf8");
const urls = NYE_LANGS().map((l) => `https://chifbay.com/${l === "en" ? "" : `${l}/`}${NYE.slug}`);
const missing = urls.filter((u) => !xml.includes(`<loc>${u}</loc>`));
if (missing.length) {
  xml = xml.replace("</urlset>", missing.map((u) => `  <url><loc>${u}</loc><lastmod>2026-10-17</lastmod><changefreq>weekly</changefreq></url>\n`).join("") + "</urlset>");
  changed++;
  console.log(`sitemap: +${missing.length}`);
  if (WRITE) fs.writeFileSync(sm, xml);
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} change(s).`);
