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

// One card per article: posts.json is newest first, so the first entry of a
// slug is the current one.
const seenSlug = new Set();
const posts = JSON.parse(readFileSync(join(SITE, "posts", "posts.json"), "utf-8"))
  .filter((p) => !seenSlug.has(p.slug) && seenSlug.add(p.slug));
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
    // one map only: earlier runs stacked a new line every time
    html = html.replace(/\n  var TR=\{[^}]*\};(?=\n)/g, "");
    html = html.replace(/\n  var list=document\.getElementById\('bloglist'\)/,
      "\n  " + map + "var list=document.getElementById('bloglist')");
    html = html.replace(
      /var badge=BADGE\?' <span class="blang">'\+esc\(BADGE\)\+'<\/span>':'';/,
      "var badge=(BADGE&&!TR[p.slug])?' <span class=\"blang\">'+esc(BADGE)+'</span>':'';");
    html = html.replace(
      /'<a class="bcard" href="\/posts\/'\+encodeURIComponent\(p\.slug\)\+'\.html"'\+\(BADGE\?' hreflang="en"':''\)\+'>'/,
      `'<a class="bcard" href="'+(TR[p.slug]?'/${cfg.dir}/posts/':'/posts/')+encodeURIComponent(p.slug)+'.html"'+((BADGE&&!TR[p.slug])?' hreflang="en"':'')+'>'`);
  }

  // The cards themselves, written into the page (2 Oct 2026 audit: the grid
  // was empty until posts.json arrived). Same markup, labels, date format and
  // links as the page's own script, which then only redraws when posts.json
  // holds something newer than this build.
  const cfgJs = (re, d) => { const m = html.match(re); return m ? m[1] : d; };
  let CAT = {};
  try { CAT = JSON.parse(cfgJs(/var CAT=(\{[^;]*\});/, "{}")); } catch { CAT = {}; }
  const LOC = cfgJs(/var LOC="([^"]+)"/, "en-GB"), READ = cfgJs(/READ="([^"]+)"/, "min read");
  const tr = new Set(rows.filter((r) => r.translated && lang !== "en").map((r) => r.slug));
  const cards = posts.map((p) => {
    const d = new Date(p.date + "T00:00:00").toLocaleDateString(LOC, { day: "numeric", month: "short", year: "numeric" });
    const local = tr.has(p.slug), en = lang !== "en" && !local;
    const href = (local ? `/${cfg.dir}/posts/` : "/posts/") + encodeURIComponent(p.slug) + ".html";
    return `<a class="bcard" data-s="${esc(p.slug)}" href="${href}"${en ? ' hreflang="en"' : ""}>` +
      `<div class="bimg" style="background-image:url('/${esc(p.heroImage)}')"></div>` +
      `<div class="bbody"><span class="bcat">${esc(CAT[p.category] || p.category)}</span>` +
      `<h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>` +
      `<span class="bmeta">${d} · ${p.readingMinutes || 5} ${esc(READ)}${en && cfg.badge ? ` <span class="blang">${esc(cfg.badge)}</span>` : ""}</span></div></a>`;
  }).join("\n");
  html = html.replace(/<div id="bloglist" class="bloggrid">(?:<!--cards-->[\s\S]*?<!--\/cards-->)?<\/div>/,
    `<div id="bloglist" class="bloggrid"><!--cards-->\n${cards}\n<!--/cards--></div>`);
  // the page script: no "nothing yet" message over real cards, no redraw when
  // the build is current, and the topic filter reads the live list
  html = html.replace("function showEmpty(){ if(document.querySelector('.blognojs li')) return;",
    "function showEmpty(){ if(document.querySelector('.blognojs li')||list.querySelector('a.bcard')) return;");
  if (!html.includes("var have=")) html = html.replace("    list.innerHTML=posts.map(function(p){",
    "    var have=[].map.call(list.querySelectorAll('a.bcard'),function(a){return a.getAttribute('data-s');}).join(',');\n" +
    "    if(have&&have===posts.map(function(p){return p.slug;}).join(',')) return;\n" +
    "    list.innerHTML=posts.map(function(p){");
  html = html.replace(`'<a class="bcard" href="'+`, `'<a class="bcard" data-s="'+esc(p.slug)+'" href="'+`)
    .replace(`'<a class="bcard" href="/posts/'+`, `'<a class="bcard" data-s="'+esc(p.slug)+'" href="/posts/'+`);
  html = html.replace("cards.forEach(function(card){var k=(card.querySelector('.bcat')||{}).textContent||''; card.hidden=!!c&&k!==c;});",
    "[].forEach.call(list.querySelectorAll('a.bcard'),function(card){var k=(card.querySelector('.bcat')||{}).textContent||''; card.hidden=!!c&&k!==c;});");

  if (html !== before) { writeFileSync(page, html); changed++; }
  const n = rows.filter((r) => r.translated).length;
  console.log(`${lang}: ${rows.length} articles listes, ${n} en ${lang}`);
}
console.log(`\n${changed} page(s) reecrite(s)`);
