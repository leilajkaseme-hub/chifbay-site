/**
 * Makes the footer's link columns and copyright line identical in shape
 * across the whole site, in every language.
 *
 *   node scripts/fix-footer.mjs           dry run
 *   node scripts/fix-footer.mjs --write   apply
 *
 * What was wrong: three different footers existed side by side.
 *   - Most pages had a "Experiences" column pointing at the marketing pages
 *     (hidden-coves-half-day.html, sunset-cruise.html) - the pages that
 *     existed BEFORE the on-site Stripe booking flow went live.
 *   - book.html / book-day.html / book-sunset.html already had the fix: a
 *     "Book" column pointing straight at /book-day.html and /book-sunset.html.
 *   - blog.html and every post under posts/ had a THIRD shape entirely
 *     ("Explore").
 *   - review.html had a stray duplicated line and a missing Privacy link -
 *     a real bug, not just inconsistency.
 *   - sunset-cruise.html listed its two trips in the opposite order.
 *
 * This makes every page match the book.html pattern: a "Book" column
 * (translated per language) linking straight to the two booking pages,
 * plus a "Contact" column and copyright line taken from each language's
 * fullest, correct existing version.
 *
 * /book-day.html and /book-sunset.html are ENGLISH-only (see the booking
 * README) and are always linked with a leading slash - the same absolute
 * pattern book.html's own footer already used, and the same pattern every
 * footer already uses for /review.html and /reviews.html. Every other link
 * (experiences.html, about.html, contact.html, privacy.html) stays relative
 * and in the page's own language, prefixed with "../" only inside posts/,
 * the one directory whose siblings live in the parent folder.
 *
 * Safe to run again: it replaces the same two blocks every time.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const LANGS = {
  en: {
    book: "Book",
    day: "Book the Day Trip",
    sunset: "Book the Sunset Trip",
    all: "All experiences",
    contact: "Contact",
    story: "The Story",
    contactLink: "Contact",
    leaveReview: "Leave a review",
    ourReviews: "Our reviews",
    privacy: "Privacy Policy",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Licensed maritime tourism operator · Madeira, Portugal",
    fbot2: "Funchal Marina · Built for the Atlantic",
  },
  fr: {
    book: "Réserver",
    day: "Réserver la sortie à la journée",
    sunset: "Réserver le coucher du soleil",
    all: "Toutes les expériences",
    contact: "Contact",
    story: "L'histoire",
    contactLink: "Contact",
    leaveReview: "Laisser un avis",
    ourReviews: "Nos avis",
    privacy: "Politique de confidentialité",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Opérateur de tourisme maritime agréé · Madère, Portugal",
    fbot2: "Marina de Funchal · Conçu pour l'Atlantique",
  },
  de: {
    book: "Buchen",
    day: "Tagestour buchen",
    sunset: "Sonnenuntergangstour buchen",
    all: "Alle Erlebnisse",
    contact: "Kontakt",
    story: "Die Geschichte",
    contactLink: "Kontakt",
    leaveReview: "Bewertung schreiben",
    ourReviews: "Unsere Bewertungen",
    privacy: "Datenschutz",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Lizenzierter Anbieter für maritimen Tourismus · Madeira, Portugal",
    fbot2: "Marina do Funchal · Gebaut für den Atlantik",
  },
  es: {
    book: "Reservar",
    day: "Reservar la salida de día",
    sunset: "Reservar la puesta de sol",
    all: "Todas las experiencias",
    contact: "Contacto",
    story: "La historia",
    contactLink: "Contacto",
    leaveReview: "Dejar una opinión",
    ourReviews: "Nuestras opiniones",
    privacy: "Política de Privacidad",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Operador turístico marítimo con licencia · Madeira, Portugal",
    fbot2: "Marina de Funchal · Construido para el Atlántico",
  },
  it: {
    book: "Prenota",
    day: "Prenota l'uscita di giorno",
    sunset: "Prenota il tramonto",
    all: "Tutte le esperienze",
    contact: "Contatti",
    story: "La Storia",
    contactLink: "Contatti",
    leaveReview: "Lascia una recensione",
    ourReviews: "Le nostre recensioni",
    privacy: "Informativa sulla Privacy",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Operatore turistico marittimo autorizzato · Madeira, Portogallo",
    fbot2: "Marina di Funchal · Costruita per l'Atlantico",
  },
  pt: {
    book: "Reservar",
    day: "Reservar o passeio de dia",
    sunset: "Reservar o pôr do sol",
    all: "Todas as experiências",
    contact: "Contacto",
    story: "A História",
    contactLink: "Contacto",
    leaveReview: "Deixar avaliação",
    ourReviews: "As nossas avaliações",
    privacy: "Política de Privacidade",
    fbot1: "32.6442° N · 16.9165° W — © <span id=\"yr\">2026</span> Chifbay · Operador de turismo marítimo licenciado · Madeira, Portugal",
    fbot2: "Marina do Funchal · Construído para o Atlântico",
  },
};

function fcBlock(t, prefix) {
  return `      <div class="fc"><h3>${t.book}</h3>
        <a href="/book-day.html">${t.day}</a>
        <a href="/book-sunset.html">${t.sunset}</a>
        <a href="${prefix}experiences.html">${t.all}</a>
      </div>
      <div class="fc"><h3>${t.contact}</h3>
        <a href="${prefix}about.html">${t.story}</a>
        <a href="${prefix}contact.html">${t.contactLink}</a>
        <a href="/review.html">${t.leaveReview}</a>
        <a href="/reviews.html">${t.ourReviews}</a>
        <a href="tel:+351937200320">+351 937 200 320</a>
        <a href="mailto:hello@chifbay.com">hello@chifbay.com</a>
        <a href="${prefix}privacy.html">${t.privacy}</a>
      </div>
    </div>
`;
}

function fbotBlock(t) {
  return `    <div class="fbot">
      <span class="fcr">${t.fbot1}</span>
      <span class="fcr">${t.fbot2}</span>
    </div>`;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "vendor"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function langAndPrefix(rel) {
  const top = rel.split(path.sep)[0];
  if (Object.prototype.hasOwnProperty.call(LANGS, top) && top !== "en") return { lang: top, prefix: "" };
  if (top === "posts") return { lang: "en", prefix: "../" };
  return { lang: "en", prefix: "" };
}

let changed = 0, skipped = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes("<footer>") || !before.includes('<div class="fc">')) { skipped++; continue; }

  const { lang, prefix } = langAndPrefix(rel);
  const t = LANGS[lang];
  let s = before;

  // Position-based, not a parsing regex: find where the .fc columns start
  // and where .fbot starts, then replace everything between wholesale -
  // including the .fg-closing </div>, which fcBlock() supplies itself. This
  // carves the region out regardless of whatever malformed nesting sits
  // inside today (review.html's stray duplicated line included), because it
  // never tries to parse that nesting - a lazy regex spanning the same
  // range would swallow that closing </div> and corrupt the rest of the
  // file, which is exactly what the first version of this script did.
  const fcTagIdx = s.indexOf('<div class="fc">');
  const fbotTagIdx = s.indexOf('<div class="fbot">');
  if (fcTagIdx === -1 || fbotTagIdx === -1 || fbotTagIdx < fcTagIdx) { skipped++; continue; }
  const fcLineStart = s.lastIndexOf("\n", fcTagIdx) + 1;
  const fbotLineStart = s.lastIndexOf("\n", fbotTagIdx) + 1;
  s = s.slice(0, fcLineStart) + fcBlock(t, prefix) + s.slice(fbotLineStart);

  // Same approach for the copyright line: from .fbot to </footer>, replacing
  // .fbot itself and re-closing .wrap, leaving </footer> untouched.
  const fbotTagIdx2 = s.indexOf('<div class="fbot">');
  const footerCloseIdx = s.indexOf("</footer>", fbotTagIdx2);
  if (footerCloseIdx === -1) { skipped++; continue; }
  const fbotLineStart2 = s.lastIndexOf("\n", fbotTagIdx2) + 1;
  s = s.slice(0, fbotLineStart2) + fbotBlock(t) + "\n  </div>\n" + s.slice(footerCloseIdx);

  if (s === before) { skipped++; continue; }
  changed++;
  console.log("  " + (WRITE ? "fix    " : "would fix ") + rel);
  if (WRITE) fs.writeFileSync(file, s, "utf8");
}

console.log(`\n${changed} pages fixed, ${skipped} left alone (no footer / no fc block there).`);
if (!WRITE) console.log("Dry run. Add --write to apply.");
