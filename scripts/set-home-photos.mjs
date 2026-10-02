// set-home-photos.mjs: home page photography, 2 Oct 2026 audit.
//   node scripts/set-home-photos.mjs          (dry run)
//   node scripts/set-home-photos.mjs --write
// Safe to run again: every change looks for the old state first.
// - crew section: deck.jpg + dolphins.jpg out, the crew at the helm and real
//   guests with a dolphin in (both real photos of our boat, daylight)
// - chapter 01: the cliff photo was captioned "Funchal Marina"; it moves to the
//   closing CTA, chapter 01 gets the drone shot at anchor with a true caption
// - closing CTA: closing.jpg (orange sky, no boat) out, our boat under the cliffs in
// - gallery: second dolphins.jpg out; daylight first, then one sunset run
// - Instagram block: says plainly it is a chosen selection, not a live feed
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const LANGS = {en: '', fr: 'fr/', de: 'de/', pt: 'pt/', es: 'es/', it: 'it/'};

const T = {
  en: {cap: 'At anchor · the south coast', ig: 'Life aboard', note: 'A hand-picked selection of our own photos, not a live feed. New posts most days on Instagram.',
       charter: 'A couple on the bow of the Chifbay boat at sunset, Funchal behind them'},
  fr: {cap: 'Au mouillage · la côte sud', ig: 'La vie à bord', note: 'Une sélection de nos propres photos, pas un fil en direct. De nouvelles publications presque chaque jour sur Instagram.',
       charter: 'Un couple sur la proue du bateau Chifbay au coucher du soleil, Funchal derrière eux'},
  de: {cap: 'Vor Anker · die Südküste', ig: 'Das Leben an Bord', note: 'Eine Auswahl unserer eigenen Fotos, kein Live-Feed. Fast täglich neue Beiträge auf Instagram.',
       charter: 'Ein Paar am Bug des Chifbay-Boots bei Sonnenuntergang, Funchal im Hintergrund'},
  pt: {cap: 'Fundeados · a costa sul', ig: 'A vida a bordo', note: 'Uma seleção das nossas próprias fotos, não um feed ao vivo. Novas publicações quase todos os dias no Instagram.',
       charter: 'Um casal na proa do barco Chifbay ao pôr do sol, com o Funchal atrás'},
  es: {cap: 'Fondeados · la costa sur', ig: 'La vida a bordo', note: 'Una selección de nuestras propias fotos, no un feed en directo. Nuevas publicaciones casi a diario en Instagram.',
       charter: 'Una pareja en la proa del barco Chifbay al atardecer, con Funchal detrás'},
  it: {cap: 'All’ancora · la costa sud', ig: 'La vita a bordo', note: 'Una selezione delle nostre foto, non un feed in diretta. Nuovi post quasi ogni giorno su Instagram.',
       charter: 'Una coppia sulla prua della barca Chifbay al tramonto, con Funchal alle spalle'},
};
// daylight run, then the sunset run (4 columns on desktop, 2 on phones)
const GALLERY = ['exp-coves', 'g-cliff-portrait', 'pool-turquoise', 'g-champagne', 'exp-coastal', 'exp-sunset', 'charter', 'hero'];

let changed = 0;
for (const [lang, dir] of Object.entries(LANGS)) {
  const file = path.join(ROOT, `${dir}index.html`);
  let s = fs.readFileSync(file, 'utf8');
  const before = s, t = T[lang], log = [];
  const sub = (re, rep, what) => { const n = s.replace(re, rep); if (n !== s) { s = n; log.push(what); } };

  // chapter 01: lead photo and its caption, then the second small tile
  sub(/(<div class="fig lead-fig clip"><div class="im" data-parallax="4" style="background-image:url\('(?:\.\.\/)?assets\/)g-cliffs(\.jpg'\)"><\/div>\s*<span class="fig-cap">)[^<]*(<\/span>)/,
    `$1exp-coves-wide$2${t.cap}$3`, 'ch01 lead');
  sub(/(url\('(?:\.\.\/)?assets\/exp-sunset\.jpg'\)"><\/div><\/div>\s*<div class="fig clip"><div class="im" style="background-image:url\('(?:\.\.\/)?assets\/)exp-coves(\.jpg'\))/, '$1why-catered$2', 'ch01 tile');
  // crew section pair
  sub(/url\('((?:\.\.\/)?)assets\/deck\.jpg'\)/, "url('$1assets/cliffs-deck.jpg')", 'crew 1');
  sub(/(<div class="fig clip"><div class="im" style="background-image:url\('(?:\.\.\/)?assets\/)dolphins(\.jpg'\))/, '$1why-yours$2', 'crew 2');
  // closing CTA
  sub(/(<section class="reserve">\s*<div class="im" style="background-image:url\('(?:\.\.\/)?assets\/)closing(\.jpg'\))/, '$1g-cliffs$2', 'closing');

  // gallery
  const g = s.match(/<div class="gal reveal">([\s\S]*?)<\/div>/);
  if (g) {
    const tiles = {};
    for (const a of g[1].match(/<a [^>]*>\s*<img[^>]*>\s*<\/a>/g) || []) tiles[a.match(/assets\/([\w-]+)\.jpg/)[1]] = a;
    tiles.charter ||= `<a href="sunset-cruise"><img loading="lazy" decoding="async" src="${dir ? '../' : ''}assets/charter.jpg" alt="${t.charter}"></a>`;
    const missing = GALLERY.filter(k => !tiles[k]);
    if (missing.length) throw new Error(`${dir}index.html gallery lacks ${missing.join(', ')}`);
    const body = '\n' + GALLERY.map(k => '      ' + tiles[k].trim()).join('\n') + '\n    ';
    sub(g[0], `<div class="gal reveal">${body}</div>`, 'gallery');
  }

  // Instagram: an honest label, not a pretend live feed
  sub(/(<section class="chapter" style="padding-top:0">\s*<div class="wrap-w">\s*<div class="chead reveal"><span class="cn">07<\/span><span class="cl">)[^<]*(<\/span>)/, `$1${t.ig}$2`, 'ig label');
  if (!s.includes('class="ignote"'))
    sub(/(<h2 class="display" data-mask>[^<]*<\/h2>)(\s*<a class="ighandle")/, `$1\n          <p class="ignote">${t.note}</p>$2`, 'ig note');

  if (s !== before) { changed++; if (WRITE) fs.writeFileSync(file, s); }
  console.log(`${dir || 'en/'}index.html: ${log.join(', ') || 'already done'}`);
}
console.log(WRITE ? `${changed} files written` : `dry run, ${changed} files would change`);
