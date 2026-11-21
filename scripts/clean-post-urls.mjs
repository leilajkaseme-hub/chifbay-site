#!/usr/bin/env node
// clean-post-urls.mjs: every Journal article declares its address without ".html".
//
//   node scripts/clean-post-urls.mjs           dry run
//   node scripts/clean-post-urls.mjs --write   apply   (safe to run again)
//
// Why: the English articles already used https://chifbay.com/posts/<slug>, but
// 131 translations (fr, de, pt, es, it) declared .../<lang>/posts/<slug>.html,
// so the sitemap mixed both forms (131 of 608 addresses, 21 Nov 2026). GitHub
// Pages serves both, so nothing breaks for a visitor; for Google one form is
// one address. Since this change post-url.mjs gives new translations the clean
// form too.
//
// What changes: the address of an article that exists in <lang>/posts/, written
// as https://chifbay.com/<lang>/posts/<slug>.html or /<lang>/posts/<slug>.html,
// loses its ".html" wherever it stands (canonical, og:url, hreflang, JSON-LD,
// the Journal lists and their script map, sitemap.xml). Links written relative
// to the page (href="x.html") are left to fix-post-links.mjs, which points every
// <a> at the canonical: run it after this.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SKIP = new Set([".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "scripts", "assets", "journal-queue", "shorts"]);
// never touched here: the payment pages and scripts (another change owns them)
const NEVER = /^(book[^/]*\.html|booking[^/]*\.(html|js))$/;

const exists = (lang, slug) => fs.existsSync(path.join(ROOT, lang, "posts", `${slug}.html`));
const RE = /(https:\/\/chifbay\.com)?\/(fr|de|pt|es|it)\/posts\/([a-z0-9-]+)\.html(?=["'#?<\s)])/g;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel);
    else if (/\.(html|json|xml)$/.test(e.name) && !NEVER.test(rel)) files.push(rel);
  }
})("");

let changed = 0, hits = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes("/posts/")) continue;
  const after = before.replace(RE, (all, origin, lang, slug) => {
    if (!exists(lang, slug)) return all;
    hits++;
    return `${origin || ""}/${lang}/posts/${slug}`;
  });
  if (after === before) continue;
  changed++;
  if (WRITE) fs.writeFileSync(file, after);
}

// the sitemap must not list one page twice
const locs = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").match(/<loc>[^<]+<\/loc>/g) || [];
const dup = locs.filter((l, i) => locs.indexOf(l) !== i);
if (WRITE && dup.length) throw new Error(`sitemap.xml lists ${dup.length} address(es) twice: ${dup.slice(0, 3).join(" ")}`);
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${hits} address(es) in ${changed} file(s).`);
