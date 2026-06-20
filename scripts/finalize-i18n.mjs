/** Deterministic post-process for all localized folders: fix asset paths,
 *  set <html lang>, canonical, og:url, og:locale; refresh availability + sitemap. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://chifbay.com";
const LANGS = ["fr","de","pt","es","it"];
const PAGES = ["index.html","experiences.html","about.html","contact.html",
  "sunset-cruise.html","hidden-coves-half-day.html","coastal-discovery-full-day.html","blog.html"];

function fixPaths(h){
  return h.replace(/href="peak\.css"/g,'href="../peak.css"')
          .replace(/src="peak\.js"/g,'src="../peak.js"')
          .replace(/href="assets\//g,'href="../assets/')
          .replace(/src="assets\//g,'src="../assets/')
          .replace(/url\('assets\//g,"url('../assets/");
}
function setMeta(h, lang, page){
  const url = `${BASE}/${lang}/${page}`;
  h = h.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}"/>`);
  if (/<meta property="og:url"/.test(h)) h = h.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}"/>`);
  if (!/<meta property="og:locale"/.test(h)) h = h.replace(/<\/head>/, `<meta property="og:locale" content="${lang}"/>\n</head>`);
  return h;
}

const present = [];
for (const lang of LANGS) {
  let any = false;
  for (const page of PAGES) {
    const f = path.join(ROOT, lang, page);
    if (!fs.existsSync(f)) continue;
    any = true;
    let h = fs.readFileSync(f, "utf8");
    h = fixPaths(setMeta(h, lang, page));
    fs.writeFileSync(f, h);
  }
  if (any) present.push(lang);
}
fs.writeFileSync(path.join(ROOT, "i18n-langs.json"), JSON.stringify(["en", ...present]) + "\n");

const sf = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(sf)) {
  let xml = fs.readFileSync(sf, "utf8");
  const add = [];
  for (const lang of present) for (const p of PAGES) {
    const u = `${BASE}/${lang}/${p}`;
    if (!xml.includes(u)) add.push(`  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`);
  }
  if (add.length) { xml = xml.replace("</urlset>", add.join("\n") + "\n</urlset>"); fs.writeFileSync(sf, xml); }
}
console.log("Finalized languages:", ["en", ...present].join(", "));
