#!/usr/bin/env node
// set-main-nav.mjs: the main menu on every page, as the owner's brief asks
// (2 Oct 2026): Experiences · Boat & Crew · Practical info · Journal. The
// logo is Home; Contact, Reviews and Leave a review live in the footer.
//
//   node scripts/set-main-nav.mjs           dry run
//   node scripts/set-main-nav.mjs --write   apply
//   add --skip '<regex>' to leave some files as they are
//
// Under Experiences: the trip pages of that language (TRIPS below).
//
// Each page keeps its own link paths (relative, ../ or /fr/...), read from
// its current Experiences / About / Journal links. Safe to run again.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SKIP = new Set(["node_modules", ".git", "ig", "social", "social-drive", "scripts", "zz-test", "vendor"]);
// 2 Oct 2026, second brief: reviews come back into the menu, and the header
// button is the same "Book now" on every page, to the booking calendar.
const L = {
  en: ["Experiences", "Boat &amp; Crew", "Practical info", "Our reviews", "Leave a review", "Journal", "Book now"],
  fr: ["Expériences", "Bateau &amp; équipage", "Infos pratiques", "Nos avis", "Laisser un avis", "Journal", "Réserver"],
  de: ["Erlebnisse", "Boot &amp; Crew", "Praktische Infos", "Bewertungen", "Bewertung schreiben", "Journal", "Jetzt buchen"],
  pt: ["Experiências", "Barco e tripulação", "Informações", "Avaliações", "Deixar avaliação", "Diário", "Reservar"],
  es: ["Experiencias", "Barco y tripulación", "Información", "Opiniones", "Dejar una opinión", "Diario", "Reservar"],
  it: ["Esperienze", "Barca ed equipaggio", "Informazioni", "Recensioni", "Lascia una recensione", "Diario", "Prenota"],
};
// 21 Nov 2026: the trip pages under "Experiences" (a menu on a computer, an
// indented list in the phone drawer; styles at the end of peak.css), so the
// pages that sell are one click from every page. Only pages that exist in the
// language; pt gets its "passeio de barco no Funchal" page instead of the
// private boat page, which has no Portuguese copy.
const TRIPS = {
  en: [["private-boat-tour-madeira", "Private boat tour"], ["hidden-coves-half-day", "Day trip with swimming"], ["sunset-cruise", "Sunset cruise"]],
  fr: [["private-boat-tour-madeira", "Bateau privé"], ["hidden-coves-half-day", "Sortie de jour avec baignade"], ["sunset-cruise", "Coucher de soleil"]],
  de: [["private-boat-tour-madeira", "Private Bootstour"], ["hidden-coves-half-day", "Tagestour mit Baden"], ["sunset-cruise", "Sonnenuntergang"]],
  pt: [["passeio-de-barco-funchal", "Passeio de barco no Funchal"], ["hidden-coves-half-day", "Passeio com banhos"], ["sunset-cruise", "Pôr do sol"]],
  es: [["hidden-coves-half-day", "Excursión con baño"], ["sunset-cruise", "Atardecer en barco"]],
  it: [["hidden-coves-half-day", "Gita con bagno"], ["sunset-cruise", "Tramonto in barca"]],
};
const tripLinks = (lang, root) => TRIPS[lang]
  .filter(([slug]) => existsSync(join(SITE, lang === "en" ? "" : lang, `${slug}.html`)))
  .map(([slug, label]) => `<a href="${root}${slug}">${label}</a>`).join("");
// --skip <regex>: leave matching files alone (e.g. pages another change is editing)
const SKIP_RE = process.argv.includes("--skip") ? new RegExp(process.argv[process.argv.indexOf("--skip") + 1]) : null;
const SECTION = (file) =>
  /(^|\/)(experiences|hidden-coves-half-day|sunset-cruise|book|book-day|book-sunset)\.html$/.test(file) ? 0 :
  /(^|\/)about\.html$/.test(file) ? 1 : /(^|\/)practical\.html$/.test(file) ? 2 :
  /(^|\/)reviews\.html$/.test(file) ? 3 : /(^|\/)review\.html$/.test(file) ? 4 :
  /(^|\/)(blog\.html|posts\/)/.test(file) ? 5 : -1;

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
  if (SKIP_RE && SKIP_RE.test(rel)) continue;
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
  // reviews pages exist in English only (/reviews, /review)
  const links = [`${root}experiences`, `${root}about`, `${root}practical`, "/reviews", "/review", `${root}blog`].map((u, i) => {
    const a = `<a href="${u}"${i === active ? ' class="active" aria-current="page"' : ""}>${lab[i]}</a>`;
    return i === 0 ? `    <div class="nd">${a}<div class="ndm">${tripLinks(lang, root)}</div></div>` : `    ${a}`;
  }).join("\n");
  const indent = m[1] || "\n  ";
  const next = `${indent}<nav class="nl">\n${links}\n  </nav>`;
  let out = h.replace(block, next);
  // the header button: same words everywhere, to the calendar in this language;
  // the booking pages keep their own in-page anchor (hidden there on phones)
  const book = lang === "en" ? "/book" : `/book?lang=${lang}`;
  out = out.replace(/<a class="nc" href="([^"]*)">[^<]*<\/a>/, (all, href) =>
    `<a class="nc" href="${href === "#bkbox" ? "#bkbox" : book}">${lab[6]}</a>`);
  if (out !== h) { changed++; if (WRITE) writeFileSync(join(SITE, rel), out); }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s); skipped (no standard links): ${skipped.length}`);
if (skipped.length) console.log(skipped.slice(0, 20).join("\n"));
