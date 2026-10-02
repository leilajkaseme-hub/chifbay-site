#!/usr/bin/env node
// set-footer.mjs: the footer in five columns, as the 2 Oct 2026 audit asks:
// Brand · Book · Contact · Explore · App, with the legal links in the bottom
// strip. Every page keeps its own translated pieces (brand text, Book links,
// social icons, app block); a page that lacks one borrows it from its
// language's home page. Links are absolute, in the page's language.
//
//   node scripts/set-footer.mjs           dry run
//   node scripts/set-footer.mjs --write   apply      (safe to run again)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SKIP = new Set(["node_modules", ".git", "ig", "social", "social-drive", "scripts", "zz-test", "vendor"]);
const L = {   // Contact, Explore, Boat & Crew, Practical, Journal, Our reviews, Leave a review, apartments, Terms
  en: ["Contact", "Explore", "Boat &amp; Crew", "Practical info", "Journal", "Our reviews", "Leave a review", "Sea-view apartments", "Terms"],
  fr: ["Contact", "Découvrir", "Bateau &amp; équipage", "Infos pratiques", "Journal", "Nos avis", "Laisser un avis", "Appartements vue mer", "Conditions générales"],
  de: ["Kontakt", "Entdecken", "Boot &amp; Crew", "Praktische Infos", "Journal", "Bewertungen", "Bewertung schreiben", "Apartments mit Meerblick", "AGB"],
  pt: ["Contacto", "Explorar", "Barco e tripulação", "Informações", "Diário", "Avaliações", "Deixar avaliação", "Apartamentos com vista mar", "Termos"],
  es: ["Contacto", "Explorar", "Barco y tripulación", "Información", "Diario", "Opiniones", "Dejar una opinión", "Apartamentos con vistas al mar", "Condiciones"],
  it: ["Contatti", "Scopri", "Barca ed equipaggio", "Informazioni", "Diario", "Recensioni", "Lascia una recensione", "Appartamenti vista mare", "Termini"],
};

const files = [];
(function walk(dir) {
  for (const e of readdirSync(join(SITE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel); else if (e.name.endsWith(".html")) files.push(rel);
  }
})("");

const langOf = (h) => ((h.match(/<html[^>]*lang="([a-z]{2})/) || [])[1]) || "en";
const grab = (s, re) => (s.match(re) || [])[0] || "";
// a balanced <div ...> block that starts at the first match of `open`
function block(s, open) {
  const i = s.search(open); if (i < 0) return "";
  const re = /<div\b|<\/div>/g; re.lastIndex = i; let depth = 0, m;
  while ((m = re.exec(s))) { depth += m[0] === "</div>" ? -1 : 1; if (!depth) return s.slice(i, re.lastIndex); }
  return "";
}
// the app block of each language's home page, for pages that have none
const homeApp = {};
for (const [lang, dir] of Object.entries({ en: "", fr: "fr/", de: "de/", pt: "pt/", es: "es/", it: "it/" }))
  homeApp[lang] = block(readFileSync(join(SITE, `${dir}index.html`), "utf8"), /<div class="fapp"/);

let changed = 0, skipped = [];
for (const rel of files) {
  const h = readFileSync(join(SITE, rel), "utf8");
  const f = grab(h, /<footer>[\s\S]*?<\/footer>/);
  if (!f) continue;
  if (f.includes('class="fg fg5"')) continue;            // already done
  const lang = langOf(h), t = L[lang] || L.en, root = lang === "en" ? "/" : `/${lang}/`;
  const up = rel.split("/").length - 1, pre = "../".repeat(up);   // for asset paths
  const fb2 = block(f, /<div class="fb2"/);
  const logo = block(fb2, /<div class="logo"/);
  const brandP = grab(fb2, /<p>[\s\S]*?<\/p>/);
  const soc = block(fb2, /<div class="fsoc"/);
  const theme = block(fb2, /<div class="themetog"/);
  let app = block(fb2, /<div class="fapp"/) || homeApp[lang].replace(/src="(?:\.\.\/)*assets\//, `src="${pre}assets/`);
  const fcs = f.match(/<div class="fc"><h3>[\s\S]*?<\/div>/g) || [];
  const bot = block(f, /<div class="fbot"/);
  if (!logo || !brandP || !soc || fcs.length < 2 || !bot || !app) { skipped.push(rel); continue; }
  const bookCol = fcs[0].replace(/href="(?:\.\.\/)*experiences(?:\.html)?"/, `href="${root}experiences"`);
  const contactCol = fcs[1];
  const href = (re) => (contactCol.match(re) || [])[1];
  const contactA = grab(contactCol, /<a href="[^"]*contact(?:\.html)?">[^<]*<\/a>/).replace(/href="[^"]*"/, `href="${root}contact"`);
  const tel = grab(contactCol, /<a href="tel:[^"]*">[^<]*<\/a>/), mail = grab(contactCol, /<a href="mailto:[^"]*">[^<]*<\/a>/);
  const privacyText = (contactCol.match(/<a href="[^"]*privacy(?:\.html)?">([^<]*)<\/a>/) || [])[1];
  const livro = grab(contactCol, /<a class="livro-reclamacoes"[^>]*>[^<]*<\/a>/);
  if (!contactA || !tel || !mail || !privacyText || !livro) { skipped.push(rel); continue; }
  const privacyHref = existsSync(join(SITE, `${lang === "en" ? "" : lang + "/"}privacy.html`)) ? `${root}privacy` : "/privacy";
  // the app block becomes its own column: its eyebrow is the column title
  const appTitle = (app.match(/<span class="eyebrow[^"]*">([^<]*)<\/span>/) || [])[1] || "App";
  const appBody = app.replace(/^<div class="fapp"[^>]*>/, "").replace(/<\/div>$/, "").replace(/\s*<span class="eyebrow[^"]*">[^<]*<\/span>/, "").trim();

  const fg = `<div class="fg fg5">
      <div class="fb2">
        ${logo}
        ${brandP}
        ${theme}
      </div>
      ${bookCol}
      <div class="fc"><h3>${t[0]}</h3>
        ${contactA}
        ${tel}
        ${mail}
        ${soc}
      </div>
      <div class="fc"><h3>${t[1]}</h3>
        <a href="${root}about">${t[2]}</a>
        <a href="${root}practical">${t[3]}</a>
        <a href="${root}blog">${t[4]}</a>
        <a href="/reviews">${t[5]}</a>
        <a href="/review">${t[6]}</a>
        <a href="https://chifstays.com" rel="noopener">${t[7]}&nbsp;↗</a>
      </div>
      <div class="fc fc-app" data-app-store><h3>${appTitle}</h3>
        ${appBody}
      </div>
    </div>`;
  const legal = `<div class="flegal"><a href="${privacyHref}">${privacyText}</a><a href="/terms">${t[8]}</a>${livro}</div>`;
  const newBot = bot.replace(/^<div class="fbot">/, `<div class="fbot">\n      ${legal}`);
  const fgOld = block(f, /<div class="fg"/);
  let nf = f.replace(fgOld, fg).replace(bot, newBot);
  const out = h.replace(f, nf);
  if (out !== h) { changed++; if (WRITE) writeFileSync(join(SITE, rel), out); }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s); skipped: ${skipped.length}`);
if (skipped.length) console.log(skipped.slice(0, 30).join("\n"));
