// policy.test.mjs: the site must never contradict the owner's commercial facts.
//   node --test scripts/checks/policy.test.mjs
//
// Facts confirmed by the owner on 2 Oct 2026:
//   - free cancellation up to 24 hours before departure (the terms page said 48)
//   - drone footage, Insta360 video and photos on EVERY trip (pages said the
//     filmed video came only with the 3 h day trip)
//   - whole boat pricing from 400 EUR: for two people that is not "the same or
//     less" than shared tour tickets
// The booking API publishes the same cancellation window (cancelHours in
// /v1/catalogue, CANCEL_HOURS in booking-api/catalog.js).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANCEL_HOURS = 24;
const SKIP = new Set(['node_modules', '.git', 'ig', 'social', 'social-drive', 'zz-test', 'vendor']);

function files() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), {withFileTypes: true})) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (/\.html$/.test(e.name) || (/^booking-content\.js$/.test(e.name)) || (dir === 'scripts/locales' && e.name.endsWith('.json'))) out.push(rel);
    }
  };
  walk('');
  return out;
}

// plain text of a page: tags out, entities for apostrophes folded
const text = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
  .replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;|’/g, "'").replace(/\s+/g, ' ');

function hits(re) {
  const bad = [];
  for (const rel of files()) {
    const t = text(rel);
    for (const m of t.matchAll(re)) bad.push(`${rel}: …${t.slice(Math.max(0, m.index - 60), m.index + m[0].length + 40)}…`);
  }
  return bad;
}

test(`cancellation window is ${CANCEL_HOURS} hours everywhere`, () => {
  // any "<n> hours/heures/Stunden/horas/ore" next to a cancellation word
  const re = /(cancel|annul|storn|cancela|disdett)[^.]{0,80}?\b(\d{1,3})\s?(hours|hrs|h\b|heures|Stunden|horas|ore)|\b(\d{1,3})\s?(hours|heures|Stunden|horas|ore)[^.]{0,40}?(cancel|annul|storn|cancela|disdett)/gi;
  const bad = [];
  for (const rel of files()) {
    const t = text(rel);
    for (const m of t.matchAll(re)) {
      const n = Number(m[2] || m[4]);
      if (n !== CANCEL_HOURS) bad.push(`${rel}: ${m[0].slice(0, 140)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the terms page states the same window', () => {
  assert.match(text('terms.html'), new RegExp(`at least ${CANCEL_HOURS} hours before departure`));
});

test('no page ties the filmed / Insta360 video to the 3 h trip only', () => {
  const bad = hits(/filmed video|filmed 4K video|edited 4K video|filmed, edited|3h adds a filmed|vidéo filmée|gefilmte[sn]? Video|vídeo filmado|video girato|video filmato|vídeo grabado/gi);
  assert.deepEqual(bad, []);
});

test('no "same or less than a shared tour" price claim', () => {
  const bad = hits(/same or less than separate tickets|autant, voire moins|genauso viel oder weniger|o mesmo ou menos|lo mismo o menos que entradas|uguale o meno rispetto/gi);
  assert.deepEqual(bad, []);
});

test('the sunset trip departs at 18:30, as the booking catalogue says', () => {
  const bad = hits(/(sunset|pôr do sol|coucher (?:du|de) soleil|Sonnenuntergang|atardecer|tramonto)[^.]{0,80}?\b18:00\b|\b18:00\b[^.]{0,60}?(sunset|pôr do sol|Sonnenuntergang|atardecer|tramonto)/gi);
  assert.deepEqual(bad, []);
});
