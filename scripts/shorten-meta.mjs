#!/usr/bin/env node
// shorten-meta.mjs: search result titles and descriptions that fit.
//
//   node scripts/shorten-meta.mjs            apply scripts/data/meta-short.json
//   node scripts/shorten-meta.mjs --check    list indexable pages still too long (exit 1 if any)
//
// Measured on the live site on 4 Oct 2026: 316 <title> over 65 characters
// (310 of them Journal articles) and 132 meta descriptions over 160, so
// Google cut them mid sentence. meta-short.json holds, per page, a <title>
// of at most 62 characters (main keyword first, " | Chifbay" only when it
// fits) and/or a description of 150 to 158 characters, written by hand in
// the page's language. Only the <title> and <meta name="description"> change:
// the <h1>, og: tags, JSON-LD, posts.json and the URL stay as they are.
//
// Safe to run again: a page that already carries its short text is left
// alone. New articles get short ones from the robots (BLOG-INSTRUCTIONS.md,
// generate-post.mjs, posts-i18n.mjs); --check finds any that slip through.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/data/meta-short.json"), "utf8"));
const MAX_TITLE = 62, MAX_DESC = 158;

const text = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

if (CHECK) {
  const SKIP = new Set([".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "scripts", "assets", "print"]);
  const walk = (dir = "") => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || SKIP.has(e.name)) return [];
    const rel = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? walk(rel) : e.name.endsWith(".html") ? [rel] : [];
  });
  const bad = [];
  for (const rel of walk()) {
    const h = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (/<meta name="robots" content="[^"]*noindex/.test(h)) continue;
    const t = h.match(/<title>([\s\S]*?)<\/title>/), d = h.match(/<meta name="description" content="([^"]*)"/);
    if (t && text(t[1].trim()).length > 65) bad.push(`${rel}: title ${text(t[1].trim()).length}`);
    if (d && text(d[1]).length > 160) bad.push(`${rel}: description ${text(d[1]).length}`);
  }
  console.log(bad.length ? bad.join("\n") : "every indexable title is at most 65 characters and every description at most 160.");
  if (bad.length) process.exitCode = 1;
} else {
  let changed = 0;
  for (const [rel, want] of Object.entries(DATA)) {
    if (want.title && want.title.length > MAX_TITLE) throw new Error(`${rel}: title over ${MAX_TITLE}`);
    if (want.description && want.description.length > MAX_DESC) throw new Error(`${rel}: description over ${MAX_DESC}`);
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.log(`absent, skipped: ${rel}`); continue; }
    const before = fs.readFileSync(file, "utf8");
    let h = before;
    if (want.title) h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(want.title)}</title>`);
    if (want.description) h = h.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + escAttr(want.description) + b);
    if (h !== before) { changed++; fs.writeFileSync(file, h); }
  }
  console.log(`${changed} page(s) given their short title or description.`);
}
