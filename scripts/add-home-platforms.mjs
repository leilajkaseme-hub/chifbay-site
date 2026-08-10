/**
 * Add the "Listed & reviewed on" platform strip to the localized homepages.
 *
 *   node scripts/add-home-platforms.mjs [lang ...]     (default: fr de pt es it)
 *
 * The English homepage is the source of truth: this lifts the <section class="plat-wrap">
 * block out of /index.html verbatim and drops it into /<lang>/index.html at the same
 * place (just before CHAPTER 01), swapping only the label.
 *
 * Nothing else needs rewriting — the marks are inlined SVG paths, so unlike the other
 * home sections there are no relative asset paths to fix and no data-* strings for a
 * script to read.
 *
 * Same house style as add-home-sections.mjs: hand-written copy rather than i18n-build.mjs,
 * which needs ANTHROPIC_API_KEY. Safe to re-run — a locale that already has the strip
 * is skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "de", "pt", "es", "it"];

// Only the eyebrow needs translating; the platform names are proper nouns.
const LABEL = {
  fr: "Référencés et notés sur",
  de: "Gelistet &amp; bewertet auf",
  pt: "Listados e avaliados em",
  es: "Publicados y valorados en",
  it: "Presenti e recensiti su",
};

const ANCHOR = "<!-- CHAPTER 01";

const en = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const start = en.indexOf("<!-- PLATFORMS —");
const end = en.indexOf("</section>", en.indexOf('<section class="plat-wrap"'));
if (start === -1 || end === -1) {
  console.error("Could not find the platform strip in the English homepage.");
  process.exit(1);
}
const BLOCK = en.slice(start, end + "</section>".length);

let changed = 0;
for (const lang of LANGS) {
  const file = path.join(ROOT, lang, "index.html");
  if (!fs.existsSync(file)) { console.log(`${lang}: no index.html, skipped`); continue; }

  let html = fs.readFileSync(file, "utf8");
  if (html.includes("plat-wrap")) { console.log(`${lang}: already has the strip, skipped`); continue; }

  const at = html.indexOf(ANCHOR);
  if (at === -1) { console.log(`${lang}: CHAPTER 01 anchor not found, skipped`); continue; }

  const label = LABEL[lang];
  if (!label) { console.log(`${lang}: no label translation, skipped`); continue; }

  const block = BLOCK.replace(
    />Listed &amp; reviewed on</,
    `>${label}<`
  );

  html = html.slice(0, at) + block + "\n\n" + html.slice(at);
  fs.writeFileSync(file, html);
  console.log(`${lang}: platform strip added`);
  changed++;
}
console.log(`\n${changed} locale homepage(s) updated.`);
