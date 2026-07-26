#!/usr/bin/env node
// blog-i18n.mjs — localise le CHROME de la liste d'articles.
//
// Constat de l'audit (B04) : sur /{fr,de,pt,es,it}/blog.html, 92 % des phrases
// étaient identiques à la version anglaise. Le cadre de page est bien traduit,
// mais les cartes sont injectées en JS depuis posts.json, qui n'existe qu'en
// anglais — d'où des catégories "Food & Drink", des dates "26 Jul 2026" et des
// "7 min read" au milieu d'une page française.
//
// Ce que ce script traduit : catégories, format de date, mention de durée,
// libellé d'état vide. Ce qu'il ne traduit PAS : les titres et descriptions
// d'articles.
//
// C'est délibéré. Les 35 articles n'existent qu'en anglais. Traduire les titres
// promettrait du contenu français et livrerait une page anglaise au clic —
// pire que le problème d'origine. À la place, chaque carte porte un marqueur de
// langue discret, pour que le visiteur sache avant de cliquer. Traduire les
// articles eux-mêmes est un chantier éditorial distinct.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");

const L = {
  en: { loc: "en-GB", cat: {}, read: "min read", badge: null,
        empty: "No articles yet — check back soon." },
  fr: { loc: "fr-FR", read: "min de lecture", badge: "en anglais",
        empty: "Aucun article pour le moment — revenez bientôt.",
        cat: { "Food & Drink": "Cuisine", "Nature": "Nature", "Guide": "Guide",
               "Top 10": "Top 10", "Experience": "Expérience", "What's On": "Agenda" } },
  de: { loc: "de-DE", read: "Min. Lesezeit", badge: "auf Englisch",
        empty: "Noch keine Artikel — schauen Sie bald wieder vorbei.",
        cat: { "Food & Drink": "Essen & Trinken", "Nature": "Natur", "Guide": "Ratgeber",
               "Top 10": "Top 10", "Experience": "Erlebnis", "What's On": "Termine" } },
  pt: { loc: "pt-PT", read: "min de leitura", badge: "em inglês",
        empty: "Ainda sem artigos — volte em breve.",
        cat: { "Food & Drink": "Gastronomia", "Nature": "Natureza", "Guide": "Guia",
               "Top 10": "Top 10", "Experience": "Experiência", "What's On": "Agenda" } },
  es: { loc: "es-ES", read: "min de lectura", badge: "en inglés",
        empty: "Todavía no hay artículos — vuelve pronto.",
        cat: { "Food & Drink": "Gastronomía", "Nature": "Naturaleza", "Guide": "Guía",
               "Top 10": "Top 10", "Experience": "Experiencia", "What's On": "Agenda" } },
  it: { loc: "it-IT", read: "min di lettura", badge: "in inglese",
        empty: "Ancora nessun articolo — torna presto.",
        cat: { "Food & Drink": "Cucina", "Nature": "Natura", "Guide": "Guida",
               "Top 10": "Top 10", "Experience": "Esperienza", "What's On": "Eventi" } },
};

const block = (lang) => {
  const c = L[lang];
  return `<script>
(async function(){
  /* Chrome de la liste localisé — voir scripts/blog-i18n.mjs.
     Les titres/descriptions restent en anglais car les articles le sont ;
     le marqueur de langue le signale avant le clic. */
  var CAT=${JSON.stringify(c.cat)};
  var LOC=${JSON.stringify(c.loc)}, READ=${JSON.stringify(c.read)}, BADGE=${JSON.stringify(c.badge)};
  var list=document.getElementById('bloglist'), empty=document.getElementById('blogempty');
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];}); }
  try{
    var posts=await (await fetch('/posts/posts.json?v='+Date.now())).json();
    if(!posts.length){ empty.style.display='block'; return; }
    list.innerHTML=posts.map(function(p){
      var d=new Date(p.date+'T00:00:00').toLocaleDateString(LOC,{day:'numeric',month:'short',year:'numeric'});
      var cat=CAT[p.category]||p.category;
      var badge=BADGE?' <span class="blang">'+esc(BADGE)+'</span>':'';
      return '<a class="bcard" href="/posts/'+encodeURIComponent(p.slug)+'.html"'+(BADGE?' hreflang="en"':'')+'>'
        +'<div class="bimg" style="background-image:url(\\''+'/'+p.heroImage+'\\')"></div>'
        +'<div class="bbody"><span class="bcat">'+esc(cat)+'</span>'
        +'<h3>'+esc(p.title)+'</h3><p>'+esc(p.description)+'</p>'
        +'<span class="bmeta">'+d+' · '+(p.readingMinutes||5)+' '+esc(READ)+badge+'</span></div></a>';
    }).join('');
  }catch(e){ empty.style.display='block'; }
})();
</script>`;
};

const CSS = `
/* marqueur de langue sur les cartes du journal (voir scripts/blog-i18n.mjs) */
.blang{display:inline-block;margin-left:8px;padding:1px 7px;border:1px solid var(--hair-strong);
  border-radius:100px;font-size:.86em;letter-spacing:.06em;opacity:.72;white-space:nowrap}
`;

let n = 0;
for (const lang of Object.keys(L)) {
  const file = lang === "en" ? join(SITE, "blog.html") : join(SITE, lang, "blog.html");
  let html = readFileSync(file, "utf8");
  const start = html.indexOf("<script>\n(async function(){");
  if (start === -1) { console.error(`  ${lang}: bloc introuvable, ignoré`); continue; }
  const end = html.indexOf("</script>", start) + "</script>".length;
  const next = html.slice(0, start) + block(lang) + html.slice(end);
  if (next !== html) { writeFileSync(file, next); n++; console.log(`  ${lang}/blog.html mis à jour`); }
}

// la classe .blang vit dans atlas.css (chargé en dernier, donc il gagne)
const atlas = join(SITE, "atlas.css");
let a = readFileSync(atlas, "utf8");
if (!a.includes(".blang{")) { writeFileSync(atlas, a + CSS); console.log("  .blang ajouté à atlas.css"); }
console.log(`${n} page(s) blog localisée(s)`);
