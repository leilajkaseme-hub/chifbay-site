/**
 * Apply a hand-written premium locale (no API key needed).
 * Usage: node apply-locale.mjs <lang>   e.g. node apply-locale.mjs fr
 * Reads scripts/locales/<lang>.json ({ "English string": "Translated string", ... })
 * and produces /<lang>/<page> for every page, fixing asset paths + canonical/lang,
 * then updates i18n-langs.json and the sitemap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://chifbay.com";
const lang = process.argv[2];
if (!lang) { console.error("usage: node apply-locale.mjs <lang>"); process.exit(1); }

const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "locales", `${lang}.json`), "utf8"));
const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
const PAGES = ["index.html","experiences.html","about.html","contact.html",
  "sunset-cruise.html","hidden-coves-half-day.html","blog.html"];

function fixPaths(h){
  return h.replace(/href="(peak|atlas|motion)\.css"/g,'href="../$1.css"')
          .replace(/src="(peak|atlas|motion)\.js"/g,'src="../$1.js"')
          .replace(/src="vendor\//g,'src="../vendor/')
          .replace(/href="assets\//g,'href="../assets/')
          .replace(/src="assets\//g,'src="../assets/')
          .replace(/url\('assets\//g,"url('../assets/");
}
// Root-only pages (reviews.html, review.html) are never localized, so any
// relative link to them would resolve inside /<lang>/ and 404. Force absolute.
function fixRootOnlyLinks(h){
  return h.replace(/href="(reviews|review)\.html"/g,'href="/$1.html"');
}
// The language switcher must point at this page in each locale, not at the
// English copy it was cloned from.
function fixLangMenu(h, page){
  return h.replace(/<div class="langmenu">[\s\S]*?<\/div>/,
    '<div class="langmenu">'
    + `<a href="/${page === "index.html" ? "" : page}">English</a>`
    + ["fr","de","pt","es","it"].map((c,i) =>
        `<a href="/${c}/${page}">${["Français","Deutsch","Português","Español","Italiano"][i]}</a>`).join("")
    + "</div>");
}
function setMeta(h, page){
  const url = `${BASE}/${lang}/${page}`;
  h = h.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}"/>`);
  if (/<meta property="og:url"/.test(h)) h = h.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}"/>`);
  if (!/<meta property="og:locale"/.test(h)) h = h.replace(/<\/head>/, `<meta property="og:locale" content="${lang}"/>\n</head>`);
  return h;
}

fs.mkdirSync(path.join(ROOT, lang), { recursive: true });
for (const page of PAGES) {
  let h = fs.readFileSync(path.join(ROOT, page), "utf8");
  for (const [en, tr] of entries) h = h.split(en).join(tr);
  h = fixLangMenu(fixRootOnlyLinks(fixPaths(setMeta(h, page))), page);
  fs.writeFileSync(path.join(ROOT, lang, page), h);
  console.log("  wrote", `${lang}/${page}`);
}

// Untranslated English left behind is worse than an obvious gap — report it.
{
  const miss = [];
  for (const page of PAGES) {
    const h = fs.readFileSync(path.join(ROOT, lang, page), "utf8");
    for (const probe of ["Up to 7", "the whole boat", "Book 2h", "Day Trip", "Sunset Trip"])
      if (h.includes(probe)) miss.push(`${page}: "${probe}"`);
  }
  if (miss.length) console.warn(`  ! untranslated in ${lang}:\n    ` + miss.join("\n    "));
}

// availability
const lf = path.join(ROOT, "i18n-langs.json");
let avail = ["en"];
try { avail = JSON.parse(fs.readFileSync(lf, "utf8")); } catch {}
if (!avail.includes(lang)) avail.push(lang);
fs.writeFileSync(lf, JSON.stringify(avail) + "\n");

// sitemap
const sf = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(sf)) {
  let xml = fs.readFileSync(sf, "utf8");
  const add = PAGES.map(p => `${BASE}/${lang}/${p}`).filter(u => !xml.includes(u))
    .map(u => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`);
  if (add.length) { xml = xml.replace("</urlset>", add.join("\n") + "\n</urlset>"); fs.writeFileSync(sf, xml); }
}
console.log(`Done: ${lang}. Languages available:`, avail.join(", "));
