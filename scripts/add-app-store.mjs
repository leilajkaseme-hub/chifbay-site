/**
 * Puts the App Store badge in the footer, and Apple's Smart App Banner in the
 * head, of every page that should carry them.
 *
 *   node scripts/add-app-store.mjs           dry run
 *   node scripts/add-app-store.mjs --write   apply
 *
 * Safe to run again: it removes whatever it wrote before and writes it fresh,
 * so it repairs rather than stacks up.
 *
 * TWO KINDS OF PAGE ARE LEFT ALONE, ON PURPOSE, and it is the part that
 * matters:
 *
 *   - The booking flow (book, book-day, book-sunset, booking-done) and the
 *     private quote pages. Someone there is about to pay. Offering them a
 *     download is offering them a way out of the checkout.
 *
 *   - Partner landing pages (one folder per slug in booking-api/partners.js,
 *     and /partner/). A partner is paid on bookings made on the WEB, through
 *     their link. The app carries no partner attribution, so a partner's guest
 *     sent to the app is a booking that partner never gets credited for.
 *
 * The badge is Apple's own artwork, one per language, fetched from Apple's
 * marketing toolbox into assets/app-store/. Apple's rules forbid recolouring
 * or redrawing it, so the site's look is in the frame around it, not in it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const APP_ID = "6811650007";
const STORE = `https://apps.apple.com/app/id${APP_ID}`;
const BADGE_H = 44;

// The claim is true, and it is the reason the app exists at all: the booking
// and the meeting point are saved on the phone and open with no signal.
const TEXT = {
  en: { badge: "en-us", eyebrow: "The Chifbay app",
        line: "Your booking and the meeting point on your phone, even with no signal.",
        alt: "Download on the App Store" },
  fr: { badge: "fr-fr", eyebrow: "L'application Chifbay",
        line: "Votre réservation et le point de rendez-vous sur votre téléphone, même sans réseau.",
        alt: "Télécharger dans l'App Store" },
  de: { badge: "de-de", eyebrow: "Die Chifbay App",
        line: "Ihre Buchung und der Treffpunkt auf Ihrem Handy, auch ohne Netz.",
        alt: "Laden im App Store" },
  pt: { badge: "pt-pt", eyebrow: "A app Chifbay",
        line: "A sua reserva e o ponto de encontro no telemóvel, mesmo sem rede.",
        alt: "Descarregar na App Store" },
  es: { badge: "es-es", eyebrow: "La app de Chifbay",
        line: "Tu reserva y el punto de encuentro en el móvil, incluso sin cobertura.",
        alt: "Descárgalo en el App Store" },
  it: { badge: "it-it", eyebrow: "L'app Chifbay",
        line: "La tua prenotazione e il punto d'incontro sul telefono, anche senza rete.",
        alt: "Scarica su App Store" },
};

// Width at our height, read from each badge's own viewBox. The localised
// badges are not the same width (the German one is the shortest), so one
// width attribute for all would squash or stretch five of them. Real
// dimensions also stop the footer from jumping while the image loads.
const WIDTH = {};
for (const t of Object.values(TEXT)) {
  const svg = fs.readFileSync(path.join(ROOT, "assets", "app-store", `badge-${t.badge}.svg`), "utf8");
  const m = svg.match(/viewBox="\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/);
  if (!m) throw new Error(`no viewBox in badge-${t.badge}.svg`);
  WIDTH[t.badge] = Math.round((Number(m[1]) / Number(m[2])) * BADGE_H);
}

const partnerSrc = fs.readFileSync(path.join(ROOT, "..", "booking-api", "partners.js"), "utf8");
const PARTNERS = new Set([...partnerSrc.matchAll(/^\s{2}"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]));

function skipReason(rel) {
  const top = rel.split(path.sep)[0];
  if (/^(book(-day|-sunset)?|booking-done)\.html$/.test(path.basename(rel)) && !rel.includes(path.sep))
    return "checkout";
  if (top === "private") return "private quote";
  if (top === "partner" || PARTNERS.has(top)) return "partner page";
  return "";
}

const META = `<meta name="apple-itunes-app" content="app-id=${APP_ID}">`;
const OLD_META = /[ \t]*<meta name="apple-itunes-app"[^>]*>\n?/g;
const OLD_BLOCK = /[ \t]*<div class="fapp" data-app-store>[\s\S]*?<\/div>\n?/g;

function block(lang, prefix) {
  const t = TEXT[lang] || TEXT.en;
  return (
    `        <div class="fapp" data-app-store>\n` +
    `          <span class="eyebrow gold">${t.eyebrow}</span>\n` +
    `          <p>${t.line}</p>\n` +
    `          <a class="fappb" href="${STORE}" target="_blank" rel="noopener">` +
    `<img src="${prefix}assets/app-store/badge-${t.badge}.svg" alt="${t.alt}" ` +
    `width="${WIDTH[t.badge]}" height="${BADGE_H}" loading="lazy" decoding="async"></a>\n` +
    `        </div>\n`
  );
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "vendor", "scripts"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const stats = { changed: 0, unchanged: 0, skipped: {}, noFooter: 0, noFsoc: 0, byLang: {} };

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const why = skipReason(rel);
  if (why) { stats.skipped[why] = (stats.skipped[why] || 0) + 1; continue; }

  const before = fs.readFileSync(file, "utf8");
  // Old copies first, so a re-run never stacks a second badge or meta.
  let html = before.replace(OLD_META, "").replace(OLD_BLOCK, "");

  const fStart = html.indexOf("<footer>");
  const fEnd = html.indexOf("</footer>", fStart);
  if (fStart === -1 || fEnd === -1) { stats.noFooter++; continue; }

  const soc = html.indexOf('<div class="fsoc">', fStart);
  if (soc === -1 || soc > fEnd) { stats.noFsoc++; continue; }
  // The social row holds only <a><svg>, no nested div, so the first </div>
  // after it closes it.
  const socEnd = html.indexOf("</div>", soc) + "</div>".length;
  const after = html.indexOf("\n", socEnd) + 1;

  const lang = (html.match(/<html[^>]*\slang="([a-z]{2})/i) || [, "en"])[1].toLowerCase();
  const depth = rel.split(path.sep).length - 1;
  const prefix = "../".repeat(depth);
  html = html.slice(0, after) + block(lang, prefix) + html.slice(after);

  const head = html.indexOf("</head>");
  if (head !== -1) html = html.slice(0, head) + META + "\n" + html.slice(head);

  if (html === before) { stats.unchanged++; continue; }
  stats.changed++;
  stats.byLang[lang] = (stats.byLang[lang] || 0) + 1;
  if (WRITE) fs.writeFileSync(file, html);
}

console.log(WRITE ? "WRITTEN" : "DRY RUN, nothing written (add --write)");
console.log(`pages given the badge + banner: ${stats.changed}   by language:`, stats.byLang);
console.log(`already up to date: ${stats.unchanged}`);
console.log(`left alone on purpose:`, stats.skipped);
console.log(`no footer: ${stats.noFooter}   footer without the social row: ${stats.noFsoc}`);
