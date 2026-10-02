#!/usr/bin/env node
// set-main-nav.mjs: the main menu on every page, as the owner's brief asks
// (2 Oct 2026): Experiences · Boat & Crew · Practical info · Journal. The
// logo is Home; Contact, Reviews and Leave a review live in the footer.
//
//   node scripts/set-main-nav.mjs           dry run
//   node scripts/set-main-nav.mjs --write   apply
//
// Each page keeps its own link paths (relative, ../ or /fr/...), read from
// its current Experiences / About / Journal links. Safe to run again.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SKIP = new Set(["node_modules", ".git", "ig", "social", "social-drive", "scripts", "zz-test", "vendor"]);
const L = {
  en: ["Experiences", "Boat &amp; Crew", "Practical info", "Journal"],
  fr: ["Expériences", "Bateau &amp; équipage", "Infos pratiques", "Journal"],
  de: ["Erlebnisse", "Boot &amp; Crew", "Praktische Infos", "Journal"],
  pt: ["Experiências", "Barco e tripulação", "Informações", "Diário"],
  es: ["Experiencias", "Barco y tripulación", "Información", "Diario"],
  it: ["Esperienze", "Barca ed equipaggio", "Informazioni", "Diario"],
};
const SECTION = (file) =>
  /(^|\/)(experiences|hidden-coves-half-day|sunset-cruise|book|book-day|book-sunset)\.html$/.test(file) ? 0 :
  /(^|\/)about\.html$/.test(file) ? 1 : /(^|\/)practical\.html$/.test(file) ? 2 :
  /(^|\/)(blog\.html|posts\/)/.test(file) ? 3 : -1;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(join(SITE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel); else if (e.name.endsWith(".html")) files.push(rel);
  }
})("");

let changed = 0, skipped = [];
for (const rel of files) {
  const h = readFileSync(join(SITE, rel), "utf8");
  const m = h.match(/(\n?[ \t]*)<nav class="nl">[\s\S]*?<\/nav>/);
  if (!m) continue;
  const block = m[0];
  const href = (re) => (block.match(new RegExp(`href="([^"]*?${re})"`)) || [])[1];
  const exp = href("experiences(?:\\.html)?"), about = href("about(?:\\.html)?"), blog = href("blog(?:\\.html)?");
  if (!exp || !about || !blog) { skipped.push(rel); continue; }
  const lang = ((h.match(/<html[^>]*lang="([a-z]{2})/) || [])[1]) || "en";
  const lab = L[lang] || L.en;
  // absolute, in the page's own language: the old relative links sent the
  // translated articles (/fr/posts/x) to the ENGLISH pages (../../experiences)
  const root = lang === "en" ? "/" : `/${lang}/`;
  const active = SECTION(rel);
  const links = [`${root}experiences`, `${root}about`, `${root}practical`, `${root}blog`].map((u, i) =>
    `    <a href="${u}"${i === active ? ' class="active" aria-current="page"' : ""}>${lab[i]}</a>`).join("\n");
  const indent = m[1] || "\n  ";
  const next = `${indent}<nav class="nl">\n${links}\n  </nav>`;
  if (next !== block) { changed++; if (WRITE) writeFileSync(join(SITE, rel), h.replace(block, next)); }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s); skipped (no standard links): ${skipped.length}`);
if (skipped.length) console.log(skipped.slice(0, 20).join("\n"));
