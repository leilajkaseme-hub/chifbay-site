#!/usr/bin/env node
// add-legal-links.mjs: "Legal notice" and "Cookies" in the footer of every page,
// and the privacy page's dead "Change my cookie choice" button turned into a link
// to the cookie policy (there is no banner to reopen any more).
//
//   node scripts/add-legal-links.mjs           dry run
//   node scripts/add-legal-links.mjs --write   applies it
//
// The pages themselves come from scripts/build-legal-pages.mjs. blog-auto runs this
// after every new article, so new pages get the links too. Safe to run again.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SKIP = new Set(["node_modules", ".git", "ig", "ig-auto", "social", "social-drive", "scripts", "zz-test", "vendor", "print", "story-9x16", "journal-queue", "assets", "data"]);
const NOTICE = { en: "Legal notice", fr: "Mentions légales", de: "Impressum", pt: "Aviso legal", es: "Aviso legal", it: "Note legali" };
const COOKIES = { en: "Cookies", fr: "Cookies", de: "Cookies", pt: "Cookies", es: "Cookies", it: "Cookie" };
const READ = {
  en: "Read our cookie policy", fr: "Lire notre politique de cookies", de: "Unsere Cookie-Richtlinie lesen",
  pt: "Ler a nossa política de cookies", es: "Leer nuestra política de cookies", it: "Leggi la nostra cookie policy",
};

const files = [];
(function walk(dir) {
  for (const e of readdirSync(join(SITE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel); else if (e.name.endsWith(".html")) files.push(rel);
  }
})("");

let changed = 0;
for (const rel of files) {
  const abs = join(SITE, rel);
  const h = readFileSync(abs, "utf8");
  const lang = (h.match(/<html[^>]*lang="([a-z]{2})/) || [])[1] || "en";
  const root = lang === "en" ? "" : `/${lang}`;
  let out = h;
  if (!out.includes(`href="${root}/legal-notice"`) && /<div class="flegal">/.test(out)) {
    // right after the Terms link (the 2nd link of the strip), before the complaints book
    out = out.replace(/(<div class="flegal">(?:<a [^>]*>[^<]*<\/a>){2})/,
      `$1<a href="${root}/legal-notice">${NOTICE[lang] || NOTICE.en}</a><a href="${root}/cookies">${COOKIES[lang] || COOKIES.en}</a>`);
  }
  out = out.replace(/<p><button type="button" class="cb-consent-reopen"[\s\S]*?<\/button><\/p>/,
    `<p><a href="${root}/cookies">${READ[lang] || READ.en}</a></p>`);
  if (out !== h) { changed++; if (WRITE) writeFileSync(abs, out); }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s) changed`);
