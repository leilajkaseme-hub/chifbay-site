// set-home-wide.mjs: the 2 Oct 2026 audit's "immersive" home sections.
// Reviews become a full-width navy band, the gallery and Instagram blocks
// span the screen; the review rail and the phone gallery get translated
// labels for their buttons. Styling lives in tide.css (.t-wide, .t-band-navy).
//   node scripts/set-home-wide.mjs [--write]      (safe to run again)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const T = {  // read on, more, less, pause, play, previous photo, next photo
  en: ['Read on {p}', 'Read more', 'Show less', 'Pause reviews', 'Play reviews', 'Previous photo', 'Next photo'],
  fr: ['Lire sur {p}', 'Lire la suite', 'Réduire', 'Mettre les avis en pause', 'Relancer les avis', 'Photo précédente', 'Photo suivante'],
  de: ['Auf {p} lesen', 'Weiterlesen', 'Weniger', 'Bewertungen anhalten', 'Bewertungen abspielen', 'Vorheriges Foto', 'Nächstes Foto'],
  pt: ['Ler no {p}', 'Ler mais', 'Mostrar menos', 'Pausar avaliações', 'Retomar avaliações', 'Foto anterior', 'Foto seguinte'],
  es: ['Leer en {p}', 'Leer más', 'Mostrar menos', 'Pausar opiniones', 'Reanudar opiniones', 'Foto anterior', 'Foto siguiente'],
  it: ['Leggi su {p}', 'Leggi tutto', 'Mostra meno', 'Metti in pausa le recensioni', 'Riprendi le recensioni', 'Foto precedente', 'Foto successiva'],
};
for (const [lang, t] of Object.entries(T)) {
  const file = path.join(ROOT, lang === 'en' ? 'index.html' : `${lang}/index.html`);
  const before = fs.readFileSync(file, 'utf8');
  const log = [];
  // work section by section so each class lands on the right one
  const parts = before.split(/(?=<section\b)/);
  for (let i = 0; i < parts.length; i++) {
    const add = parts[i].includes('id="revsLive"') ? 't-wide t-band-navy'
      : parts[i].includes('class="gal reveal') ? 't-wide t-gal'
      : parts[i].includes('class="igsec"') ? 't-wide' : '';
    if (!add || /^<section class="chapter t-wide/.test(parts[i])) continue;
    parts[i] = parts[i].replace(/^<section class="chapter"/, `<section class="chapter ${add}"`);
    log.push(add.split(' ').pop());
  }
  let s = parts.join('');
  if (!s.includes('data-read-on=')) {
    s = s.replace(/(<div class="revs" id="revsLive")/, `$1 data-read-on="${t[0]}" data-more="${t[1]}" data-less="${t[2]}" data-pause="${t[3]}" data-play="${t[4]}"`);
    log.push('review labels');
  }
  if (!s.includes('data-gal-prev=')) {
    s = s.replace(/<div class="gal reveal">/, `<div class="gal reveal" data-gal-prev="${t[5]}" data-gal-next="${t[6]}">`);
    log.push('gallery labels');
  }
  if (s !== before && WRITE) fs.writeFileSync(file, s);
  console.log(`${lang}: ${log.join(', ') || 'already done'}`);
}
