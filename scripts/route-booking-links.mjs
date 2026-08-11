/**
 * Points every booking link at the right one of the three booking pages.
 *
 *   node scripts/route-booking-links.mjs           dry run, prints what it would do
 *   node scripts/route-booking-links.mjs --write   actually writes
 *
 * The rule:
 *   sunset-cruise.html         -> /book-sunset.html
 *   hidden-coves-half-day.html -> /book-day.html
 *   experiences.html           -> the card's own page (day card / sunset card)
 *
 * Inside the "two options" block each button also carries ?v=<variant>, so the
 * visitor lands on the calendar with that option already chosen instead of
 * being asked to pick it again.
 *
 * Runs on the English pages and on all five locales.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const LOCALES = ["", "fr/", "de/", "pt/", "es/", "it/"];

const DAY = "/book-day.html";
const SUN = "/book-sunset.html";

// Which variant each of the two option blocks sells, in page order.
const OPTION_VARIANTS = {
  "sunset-cruise.html": ["cabo-girao", "ribeira-brava"],
  "hidden-coves-half-day.html": ["ribeira-brava", "ponta-do-sol"],
};

// The "already selected" line under each option button, per language.
const HINTS = {
  en: "That option is already selected on the next screen.",
  fr: "Cette option est déjà sélectionnée à l’écran suivant.",
  de: "Diese Option ist auf dem nächsten Bildschirm bereits ausgewählt.",
  pt: "Essa opção já vem selecionada no ecrã seguinte.",
  es: "Esa opción ya viene seleccionada en la pantalla siguiente.",
  it: "Quell’opzione è già selezionata nella schermata successiva.",
};

let changed = 0, touched = 0;

/**
 * Put every booking link back to plain /book.html first, so the script can be
 * run again safely and so a link that ended up on the wrong page gets repaired
 * instead of being left alone.
 */
const reset = (html) =>
  html
    .replace(/href="\/book-(?:day|sunset)\.html(?:\?v=[a-z0-9-]+)?"/g, 'href="/book.html"')
    .replace(/"https:\/\/chifbay\.com\/book-(?:day|sunset)\.html(?:\?v=[a-z0-9-]+)?"/g,
      '"https://chifbay.com/book.html"');

/**
 * Rewrite every booking link inside one chunk of markup — both the plain
 * href="/book.html" and the absolute one inside the JSON-LD offers, which is
 * the URL Google sends searchers to.
 */
const point = (chunk, target, variant) => {
  const to = target + (variant ? "?v=" + variant : "");
  return chunk
    .replace(/href="\/book\.html"/g, 'href="' + to + '"')
    .replace(/"https:\/\/chifbay\.com\/book\.html"/g, '"https://chifbay.com' + to + '"');
};

/**
 * Splits a tour page on its two `.opt` blocks so each Book button can carry
 * its own ?v=. Anything outside those blocks (hero, schema, closing CTA) just
 * gets the plain page.
 */
function tourPage(html, target, variants, lang) {
  // Only the two option cards get a ?v=. Everything else on the page — the
  // hero button, the closing "check availability" — must land on the picker,
  // because those buttons do not name an option.
  const start = html.indexOf('<div class="opts">');
  const end = start === -1 ? -1 : html.indexOf("</section>", start);
  if (start === -1 || end === -1) return point(html, target, null);

  const head = point(html.slice(0, start), target, null);
  const tail = point(html.slice(end), target, null);

  const OPT = /(<div class="opt(?: reveal[^"]*)?">)/;
  const parts = html.slice(start, end).split(OPT);
  // parts = [before, <div opt>, body1, <div opt>, body2, ...]
  // The test has to be the WHOLE pattern: `class="opts"` — the wrapper around
  // both cards — also starts with `class="opt`, and counting it as a card
  // shifts every option onto the wrong variant.
  const isOpt = new RegExp("^" + OPT.source.slice(1, -1) + "$");
  let mid = "", optIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (isOpt.test(parts[i])) { optIndex++; mid += parts[i]; continue; }
    const v = optIndex >= 0 && optIndex < variants.length ? variants[optIndex] : null;
    mid += point(parts[i], target, v);
  }
  let out = head + mid + tail;
  // The old hint told people to pick the option by hand on the next screen.
  // With ?v= that is no longer true, and a wrong instruction is worse than none.
  out = out.replace(/<p class="bk-hint">[\s\S]*?<\/p>/g,
    '<p class="bk-hint">' + HINTS[lang] + "</p>");
  return out;
}

/**
 * The experiences page has two cards with identical links. They are told apart
 * by the photo each card carries: var(--cove) is the day trip, var(--sunset)
 * is the sunset trip.
 */
function experiencesPage(html) {
  return html.replace(
    /(background-image:var\(--(cove|sunset)\)[\s\S]{0,1400}?)href="\/book\.html"/g,
    (m, head, which) => head + 'href="' + (which === "cove" ? DAY : SUN) + '"'
  );
}

for (const loc of LOCALES) {
  const lang = loc ? loc.replace("/", "") : "en";
  const jobs = [
    ["sunset-cruise.html", (h) => tourPage(h, SUN, OPTION_VARIANTS["sunset-cruise.html"], lang)],
    ["hidden-coves-half-day.html", (h) => tourPage(h, DAY, OPTION_VARIANTS["hidden-coves-half-day.html"], lang)],
    ["experiences.html", experiencesPage],
  ];
  for (const [file, fn] of jobs) {
    const p = path.join(ROOT, loc + file);
    if (!fs.existsSync(p)) { console.log("  skip   " + loc + file + "  (not found)"); continue; }
    const before = fs.readFileSync(p, "utf8");
    const after = fn(reset(before));
    touched++;
    if (before === after) { console.log("  same   " + loc + file); continue; }
    const left = (after.match(/\/book\.html/g) || []).length;
    console.log("  fix    " + loc + file +
      "   day=" + (after.match(/\/book-day\.html/g) || []).length +
      " sunset=" + (after.match(/\/book-sunset\.html/g) || []).length +
      (left ? "   !! " + left + " still on /book.html" : ""));
    if (WRITE) fs.writeFileSync(p, after, "utf8");
    changed++;
  }
}

console.log(`\n${changed} of ${touched} files ${WRITE ? "written" : "would change"}.`);
if (!WRITE) console.log("Dry run. Add --write to apply.");
