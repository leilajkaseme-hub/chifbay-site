/**
 * Sync the "Trusted by travellers on" platform marquee onto the localized homepages.
 *
 *   node scripts/add-home-platforms.mjs [lang ...]     (default: fr de pt es it)
 *
 * The English homepage is the source of truth: this lifts the platform <section> out of
 * /index.html verbatim and writes it into /<lang>/index.html at the same place (just
 * before CHAPTER 01), swapping only the heading.
 *
 * Nothing else needs rewriting — the marks are inlined SVG paths, so unlike the other
 * home sections there are no relative asset paths to fix and no data-* strings for a
 * script to read.
 *
 * Same house style as add-home-sections.mjs: hand-written copy rather than i18n-build.mjs,
 * which needs ANTHROPIC_API_KEY. Re-running REPLACES an existing block rather than
 * skipping it, so a change to the English marquee can be pushed straight out to all five.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "de", "pt", "es", "it"];

// Only the heading needs translating; the platform names are proper nouns.
const HEAD = {
  fr: "La confiance des voyageurs sur",
  de: "Reisende vertrauen uns auf",
  pt: "A confiança dos viajantes em",
  es: "La confianza de los viajeros en",
  it: "La fiducia dei viaggiatori su",
};

const ANCHOR = "<!-- CHAPTER 01";
const OPEN = "<!-- PLATFORMS —";

/** The platform section as it appears in a homepage, or null if absent. */
function findBlock(html) {
  const start = html.indexOf(OPEN);
  if (start === -1) return null;
  const sec = html.indexOf("<section class=\"plat", start);
  if (sec === -1) return null;
  const end = html.indexOf("</section>", sec);
  if (end === -1) return null;
  return { start, end: end + "</section>".length };
}

const en = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const enAt = findBlock(en);
if (!enAt) {
  console.error("Could not find the platform section in the English homepage.");
  process.exit(1);
}
const BLOCK = en.slice(enAt.start, enAt.end);
const EN_HEAD = /id="platLabel">([^<]+)</.exec(BLOCK)?.[1];
if (!EN_HEAD) { console.error("Could not read the English heading."); process.exit(1); }

let changed = 0;
for (const lang of LANGS) {
  const file = path.join(ROOT, lang, "index.html");
  if (!fs.existsSync(file)) { console.log(`${lang}: no index.html, skipped`); continue; }

  const head = HEAD[lang];
  if (!head) { console.log(`${lang}: no heading translation, skipped`); continue; }

  let html = fs.readFileSync(file, "utf8");
  const block = BLOCK.replace(`>${EN_HEAD}<`, `>${head}<`);

  const at = findBlock(html);
  if (at) {
    if (html.slice(at.start, at.end) === block) { console.log(`${lang}: already current, skipped`); continue; }
    html = html.slice(0, at.start) + block + html.slice(at.end);
    console.log(`${lang}: marquee replaced`);
  } else {
    const anchor = html.indexOf(ANCHOR);
    if (anchor === -1) { console.log(`${lang}: CHAPTER 01 anchor not found, skipped`); continue; }
    html = html.slice(0, anchor) + block + "\n\n" + html.slice(anchor);
    console.log(`${lang}: marquee added`);
  }
  fs.writeFileSync(file, html);
  changed++;
}
console.log(`\n${changed} locale homepage(s) updated.`);
