#!/usr/bin/env node
// fix-post-links.mjs: every link to a Journal article points at its canonical URL.
//
//   node scripts/fix-post-links.mjs            write
//   node scripts/fix-post-links.mjs --check    count, write nothing (exit 1 if any)
//
// The English articles declare their canonical without ".html"
// (https://chifbay.com/posts/<slug>), and most of the site linked to
// /posts/<slug>.html: 338 internal links to a URL that is not the canonical
// one, measured on the live site on 4 Oct 2026. A crawler follows a link,
// lands on a page that says "my real address is elsewhere", and counts it as
// a redirect hop. Each article keeps whatever canonical it declares (some
// translations use ".html", see post-url.mjs); this only makes the links
// agree with it.
//
// Only <a href> is touched, never <link rel="canonical"> or hreflang (those
// are checked by checks/verify-seo.mjs) and never code inside <script>.
// Safe to run again: a second run changes nothing. blog-auto.yml runs it
// after each new article.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const SKIP = new Set([".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "scripts", "assets"]);
const SITE = "https://chifbay.com/";

function pages(dir = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...pages(rel));
    else if (e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

// canonical path (no origin) of every article, keyed by its file
const canon = new Map();
for (const rel of pages()) {
  if (!/(^|\/)posts\/[a-z0-9-]+\.html$/.test(rel)) continue;
  const m = fs.readFileSync(path.join(ROOT, rel), "utf8").match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (m && m[1].startsWith(SITE)) canon.set(rel, "/" + m[1].slice(SITE.length));
}

// the article file a link points at, or null
function target(href, page) {
  const [p] = href.split(/[?#]/);
  let rel;
  if (p.startsWith(SITE)) rel = p.slice(SITE.length);
  else if (p.startsWith("/")) rel = p.slice(1);
  else if (/^[a-z]+:/i.test(p)) return null;
  else rel = path.posix.normalize(path.posix.join(path.posix.dirname(page), p));
  if (!/(^|\/)posts\/[a-z0-9-]+(\.html)?$/.test(rel)) return null;
  return rel.endsWith(".html") ? rel : rel + ".html";
}

let links = 0, files = 0;
for (const page of pages()) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, "utf8");
  const stash = [];
  let html = before.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => `\u0000${stash.push(m) - 1}\u0000`);
  html = html.replace(/(<a\b[^>]*?\shref=")([^"]+)(")/g, (all, a, href, b) => {
    const t = target(href, page);
    const c = t && canon.get(t);
    if (!c) return all;
    const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    const want = c + hash;
    const cur = href.startsWith(SITE) ? "/" + href.slice(SITE.length) : href;
    if (cur === want) return all;
    links++;
    return a + want + b;
  });
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
  if (html !== before) { files++; if (!CHECK) fs.writeFileSync(file, html); }
}
console.log(`${links} article link(s) ${CHECK ? "to fix" : "pointed at the canonical URL"} in ${files} page(s).`);
if (CHECK && links) process.exitCode = 1;
