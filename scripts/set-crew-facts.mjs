// set-crew-facts.mjs: Boat & Crew page facts, confirmed by the owner 2 Oct 2026:
// TWO local skippers, a 2026 Karnic R8S. The page still said "one local
// skipper", "refit 2025" and "a decade" for a crew where one skipper is young.
//   node scripts/set-crew-facts.mjs [--write]      (safe to run again)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const T = {
  en: ['One boat, two local skippers, and a simple idea: the boat, the route and the day should be entirely yours.',
    'A private boat, two local skippers, the whole coast', 'Born on this coast',
    'Our two skippers were born and raised in Madeira and read this coast every day: where the dolphins feed, which coves stay calm in a north wind, where the light falls best late in the day.',
    'Born here', 'Madeira-born, fully licensed skippers who know the coast, the wildlife and the calmest water in any conditions.'],
  fr: ['Un bateau, deux skippers locaux, et une idée simple : le bateau, l\'itinéraire et la journée doivent être entièrement à vous.',
    'Un bateau privé, deux skippers locaux, toute la côte', 'Nés sur cette côte',
    'Nos deux skippers sont nés et ont grandi à Madère et lisent cette côte chaque jour : où les dauphins se nourrissent, quelles criques restent calmes par vent du nord, où la lumière tombe le mieux en fin de journée.',
    'Nés ici', 'Des skippers nés à Madère et pleinement agréés, qui connaissent la côte, la faune et les eaux les plus calmes en toutes conditions.'],
  de: ['Ein Boot, zwei einheimische Skipper und eine einfache Idee: das Boot, die Route und der Tag sollen ganz Ihnen gehören.',
    'Ein Privatboot, zwei einheimische Skipper, die ganze Küste', 'An dieser Küste geboren',
    'Unsere zwei Skipper sind auf Madeira geboren und aufgewachsen und lesen diese Küste jeden Tag: wo die Delfine fressen, welche Buchten bei Nordwind ruhig bleiben, wo das Licht am späten Tag am schönsten fällt.',
    'Hier geboren', 'Auf Madeira geborene, voll lizenzierte Skipper, die die Küste, die Tierwelt und das ruhigste Wasser bei jedem Wetter kennen.'],
  pt: ['Um barco, dois skippers locais e uma ideia simples: o barco, o percurso e o dia devem ser inteiramente seus.',
    'Um barco privado, dois skippers locais, toda a costa', 'Nascidos nesta costa',
    'Os nossos dois skippers nasceram e cresceram na Madeira e leem esta costa todos os dias: onde os golfinhos se alimentam, que enseadas se mantêm calmas com vento de norte, onde a luz cai melhor ao fim do dia.',
    'Nascidos aqui', 'Skippers nascidos na Madeira e totalmente licenciados, que conhecem a costa, a vida selvagem e as águas mais calmas em qualquer condição.'],
  es: ['Un barco, dos patrones locales y una idea sencilla: el barco, la ruta y el día deben ser enteramente vuestros.',
    'Un barco privado, dos patrones locales, toda la costa', 'Nacidos en esta costa',
    'Nuestros dos patrones nacieron y crecieron en Madeira y leen esta costa cada día: dónde se alimentan los delfines, qué calas se mantienen en calma con viento del norte, dónde cae mejor la luz al final del día.',
    'De aquí', 'Patrones nacidos en Madeira y plenamente autorizados que conocen la costa, la fauna y las aguas más tranquilas en cualquier condición.'],
  it: ['Una barca, due skipper locali e un\'idea semplice: la barca, la rotta e la giornata devono essere interamente vostre.',
    'Una barca privata, due skipper locali, tutta la costa', 'Nati su questa costa',
    'I nostri due skipper sono nati e cresciuti a Madeira e leggono questa costa ogni giorno: dove si nutrono i delfini, quali cale restano calme con il vento da nord, dove la luce cade meglio a fine giornata.',
    'Nati qui', 'Skipper nati a Madeira e pienamente autorizzati, che conoscono la costa, la fauna e le acque più calme in ogni condizione.'],
};
const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');

for (const [lang, [hsub, h2a, h2b, p, h3, ii]] of Object.entries(T)) {
  const file = path.join(ROOT, lang === 'en' ? 'about.html' : `${lang}/about.html`);
  let s = fs.readFileSync(file, 'utf8');
  const before = s, log = [];
  const sub = (re, rep, what) => { const n = s.replace(re, rep); if (n !== s) { s = n; log.push(what); } };
  // the hero photo read "KARMIC" on the hull: not our boat. Our boat under the cliffs
  sub(/(<div class="hbg"[^>]*url\('(?:\.\.\/)?assets\/)boat-action(\.jpg)/, '$1g-cliffs$2', 'hero photo');
  sub(/(<p class="hsub rv in d1">)[^<]*(<\/p>)/, `$1${esc(hsub)}$2`, 'hsub');
  sub(/<span class="sn">9m<\/span><span class="sl">[^<]*<\/span>/, '<span class="sn">2026</span><span class="sl">Karnic R8S · 300 hp Mercury V8</span>', 'stat');
  sub(/<h2>[^<]*\b(?:a|un|ein|um|una|uno) (?:local skipper|skipper local|einheimischer Skipper|patrón local|skipper locale)[^<]*<\/h2>/, `<h2>${esc(h2a)}</h2>`, 'h2');
  sub(/<h2>[^<]*(?:decade|décennie|Jahrzehnt|década|decennio)[^<]*<\/h2>(\s*<p>)[^<]*(<\/p>)/, `<h2>${esc(h2b)}</h2>$1${esc(p)}$2`, 'story');
  sub(/(<div class="iico">🧭<\/div><h3>)[^<]*(<\/h3><p>)[^<]*(<\/p>)/, `$1${esc(h3)}$2${esc(ii)}$3`, 'born here');
  if (s !== before && WRITE) fs.writeFileSync(file, s);
  console.log(`${lang}: ${log.join(', ') || 'already done'}`);
}
