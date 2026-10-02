#!/usr/bin/env node
// add-blog-nav.mjs: on the six /blog pages, a "Plan your trip" strip with the
// four guides that help someone choose a trip, and category buttons that
// filter the article list. Works from the cards the page already draws, so
// links (translated articles included) stay exactly the page's own.
//
//   node scripts/add-blog-nav.mjs           dry run
//   node scripts/add-blog-nav.mjs --write   apply (safe to run again)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const FEATURED = ["day-trip-vs-sunset-cruise-madeira", "private-boat-charter-vs-shared-tour-madeira",
  "best-time-for-a-boat-trip-in-madeira", "drone-footage-boat-trip-madeira"];
const L = {
  en: ["Plan your trip", "All", "Filter the articles by topic"],
  fr: ["Préparer votre sortie", "Tous", "Filtrer les articles par thème"],
  de: ["Ihre Fahrt planen", "Alle", "Artikel nach Thema filtern"],
  pt: ["Planear o passeio", "Todos", "Filtrar os artigos por tema"],
  es: ["Planea tu salida", "Todos", "Filtrar los artículos por tema"],
  it: ["Prepara la tua uscita", "Tutti", "Filtra gli articoli per tema"],
};

const block = (l) => `<!-- blognav -->
<script>
(function(){
  var FEAT=${JSON.stringify(FEATURED)}, L=${JSON.stringify(L[l])};
  var list=document.getElementById('bloglist'); if(!list) return;
  function build(){
    var cards=[].slice.call(list.querySelectorAll('a.bcard'));
    if(!cards.length||document.querySelector('.bfeat')) return;
    // Plan your trip: copies of the four guides, in this order
    var pick=FEAT.map(function(s){return cards.filter(function(c){return c.getAttribute('href').indexOf('/'+s)!==-1;})[0];}).filter(Boolean);
    if(pick.length){
      var f=document.createElement('section'); f.className='bfeat'; f.setAttribute('aria-labelledby','bfeath');
      f.innerHTML='<h2 id="bfeath" class="bfeat-h">'+L[0]+'</h2><div class="bfeat-g"></div>';
      pick.forEach(function(c){f.lastChild.appendChild(c.cloneNode(true));});
      list.parentNode.insertBefore(f,list);
    }
    // topics, most used first
    var n={}; cards.forEach(function(c){var k=(c.querySelector('.bcat')||{}).textContent||''; if(k) n[k]=(n[k]||0)+1;});
    var cats=Object.keys(n).sort(function(a,b){return n[b]-n[a];});
    if(cats.length<2) return;
    var bar=document.createElement('div'); bar.className='bcats'; bar.setAttribute('role','group'); bar.setAttribute('aria-label',L[2]);
    bar.innerHTML=['<button type="button" aria-pressed="true" data-c="">'+L[1]+'</button>'].concat(cats.map(function(c){
      return '<button type="button" aria-pressed="false" data-c="'+c.replace(/"/g,'&quot;')+'">'+c.replace(/</g,'&lt;')+' <span>'+n[c]+'</span></button>';})).join('');
    list.parentNode.insertBefore(bar,list);
    bar.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return;
      [].forEach.call(bar.children,function(x){x.setAttribute('aria-pressed',String(x===b));});
      var c=b.getAttribute('data-c');
      cards.forEach(function(card){var k=(card.querySelector('.bcat')||{}).textContent||''; card.hidden=!!c&&k!==c;});
    });
  }
  if(list.querySelector('a.bcard')) build();
  else if('MutationObserver' in window){var mo=new MutationObserver(function(){if(list.querySelector('a.bcard')){mo.disconnect();build();}});mo.observe(list,{childList:true});}
})();
</script>
<!-- /blognav -->`;

let n = 0;
for (const l of Object.keys(L)) {
  const f = join(SITE, l === "en" ? "" : l, "blog.html");
  let h = readFileSync(f, "utf8");
  h = h.replace(/\n?<!-- blognav -->[\s\S]*?<!-- \/blognav -->/, "");
  h = h.replace(/(<script src="\/tide\.min\.js" defer><\/script>)/, block(l) + "\n$1");
  if (!h.includes("<!-- blognav -->")) throw new Error(f + ": anchor not found");
  n++;
  if (WRITE) writeFileSync(f, h);
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${n} blog page(s)`);
