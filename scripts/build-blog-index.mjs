#!/usr/bin/env node
// build-blog-index.mjs — ecrit la liste d articles DANS le HTML de chaque
// /blog.html, dans les six langues.
//
// Pourquoi ce script existe.
//
// Les cartes du Journal sont fabriquees en JavaScript depuis posts.json. Un
// robot qui ne lance pas JavaScript, et c est le cas de Semrush comme de la
// plupart des robots d IA, ne voyait donc RIEN sur les cinq pages traduites:
// 146 a 173 mots, et pas un seul lien vers un article. Mesure le 21 septembre
// 2026. Consequence en chaine: les 240 articles traduits n avaient qu un seul
// lien entrant, parfois zero.
//
// Deuxieme defaut, plus grave que le referencement: les cartes traduites
// pointaient toutes vers l article ANGLAIS, meme quand la traduction existait.
// Le script ecrit maintenant le bon lien par langue, et ne garde le marqueur
// "en anglais" que pour les articles qui ne sont vraiment pas traduits.
//
// Lancer: node scripts/build-blog-index.mjs   (puis relire le diff)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = {
  en: { dir: "", badge: null, more: "Read the article" },
  fr: { dir: "fr", badge: "en anglais", more: "Lire l'article" },
  de: { dir: "de", badge: "auf Englisch", more: "Artikel lesen" },
  pt: { dir: "pt", badge: "em inglês", more: "Ler o artigo" },
  es: { dir: "es", badge: "en inglés", more: "Leer el artículo" },
  it: { dir: "it", badge: "in inglese", more: "Leggi l'articolo" },
};

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

// Le titre traduit est dans le fichier traduit: on le lit, on ne le devine pas.
function titleOf(file, fallback) {
  try {
    const m = readFileSync(join(SITE, file), "utf-8").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return fallback;
    return m[1].replace(/\s*\|\s*Chifbay\s*$/i, "").replace(/&amp;/g, "&").trim() || fallback;
  } catch { return fallback; }
}

const posts = JSON.parse(readFileSync(join(SITE, "posts", "posts.json"), "utf-8"));
let changed = 0;

for (const [lang, cfg] of Object.entries(LANGS)) {
  const page = join(SITE, cfg.dir, "blog.html");
  if (!existsSync(page)) { console.log("absent, ignore:", page); continue; }

  const rows = posts.map((p) => {
    const local = cfg.dir ? `${cfg.dir}/posts/${p.slug}.html` : `posts/${p.slug}.html`;
    const translated = existsSync(join(SITE, local));
    const href = translated ? "/" + local : `/posts/${p.slug}.html`;
    const title = translated ? titleOf(local, p.title) : p.title;
    return { slug: p.slug, href, title, translated };
  });

  // La liste que voit un robot sans JavaScript, et une personne dont le
  // JavaScript ne charge pas.
  const noscript = "<noscript>\n" +
    '  <ul class="blognojs" style="max-width:760px;margin:0 auto;padding:0 0 0 20px;color:var(--paper-dim)">\n' +
    rows.map((r) =>
      `      <li><a href="${esc(r.href)}"${r.translated || lang === "en" ? "" : ' hreflang="en"'}>${esc(r.title)}</a>` +
      (!r.translated && lang !== "en" && cfg.badge ? ` <span>(${esc(cfg.badge)})</span>` : "") + "</li>").join("\n") +
    "\n  </ul>\n</noscript>";

  let html = readFileSync(page, "utf-8");
  const before = html;

  if (/<noscript>[\s\S]*?<\/noscript>/.test(html)) {
    html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, noscript);
  } else {
    html = html.replace(/(<p id="blogempty"[\s\S]*?<\/p>)/, `$1\n    ${noscript}`);
  }

  // Les cartes fabriquees en JavaScript doivent mener au meme endroit que la
  // liste ci dessus, sinon le robot et le visiteur voient deux sites.
  const map = "var TR={" + rows.filter((r) => r.translated && lang !== "en")
    .map((r) => JSON.stringify(r.slug) + ":1").join(",") + "};\n  ";
  if (lang !== "en") {
    html = html.replace(/\n  var list=document\.getElementById\('bloglist'\)/,
      "\n  " + map + "var list=document.getElementById('bloglist')");
    html = html.replace(
      /var badge=BADGE\?' <span class="blang">'\+esc\(BADGE\)\+'<\/span>':'';/,
      "var badge=(BADGE&&!TR[p.slug])?' <span class=\"blang\">'+esc(BADGE)+'</span>':'';");
    html = html.replace(
      /'<a class="bcard" href="\/posts\/'\+encodeURIComponent\(p\.slug\)\+'\.html"'\+\(BADGE\?' hreflang="en"':''\)\+'>'/,
      `'<a class="bcard" href="'+(TR[p.slug]?'/${cfg.dir}/posts/':'/posts/')+encodeURIComponent(p.slug)+'.html"'+((BADGE&&!TR[p.slug])?' hreflang="en"':'')+'>'`);
  }

  if (html !== before) { writeFileSync(page, html); changed++; }
  const n = rows.filter((r) => r.translated).length;
  console.log(`${lang}: ${rows.length} articles listes, ${n} en ${lang}`);
}
console.log(`\n${changed} page(s) reecrite(s)`);
