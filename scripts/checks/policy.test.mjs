// policy.test.mjs: the site must never contradict the owner's commercial facts.
//   node --test scripts/checks/policy.test.mjs
//
// Facts confirmed by the owner on 2 Oct 2026:
//   - free cancellation up to 24 hours before departure (the terms page said 48)
//   - drone footage, Insta360 video and photos on EVERY trip (pages said the
//     filmed video came only with the 3 h day trip)
//   - whole boat pricing from 400 EUR: for two people that is not "the same or
//     less" than shared tour tickets
// Owner rule of 4 Oct 2026:
//   - the sunset trip leaves 1 h 15 before that day's sunset, rounded down to
//     the quarter hour (scripts/lib/sunset.mjs): it has no fixed 18:30 any more
// The booking API publishes the same cancellation window (cancelHours in
// /v1/catalogue, CANCEL_HOURS in booking-api/catalog.js).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sunsetDeparture} from '../lib/sunset.mjs';

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

test('the sunset trip has no fixed 18:00 departure', () => {
  const bad = hits(/(sunset|pôr do sol|coucher (?:du|de) soleil|Sonnenuntergang|atardecer|tramonto)[^.]{0,80}?\b18:00\b|\b18:00\b[^.]{0,60}?(sunset|pôr do sol|Sonnenuntergang|atardecer|tramonto)/gi);
  assert.deepEqual(bad, []);
});

// The rule written out: "1 h 15" in five languages, "1 Std. 15 Min." in German.
const RULE = /1\s?h\s?15|1 Std\. 15 Min\./;

test('no sentence gives the sunset trip a fixed 18:30 (it leaves 1 h 15 before sunset)', () => {
  // A sentence naming 18:30 must carry the rule with it. The month table of
  // the practical page (ul.t-pmonths) is computed from the rule and skipped.
  const bad = [];
  for (const rel of files()) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/<ul class="t-pmonths">[\s\S]*?<\/ul>/g, ' ');
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const sentence of t.split(/(?<=[.!?])\s|"\s*[,}\]]/)) {
      if (/\b18[:h.]30\b/.test(sentence) && !RULE.test(sentence)) bad.push(`${rel}: …${sentence.trim().slice(0, 160)}…`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the sunset page and the practical page state the 1 h 15 rule in every language', () => {
  const missing = [];
  for (const l of ['', 'fr/', 'de/', 'pt/', 'es/', 'it/']) for (const p of ['sunset-cruise', 'practical']) {
    if (!RULE.test(text(`${l}${p}.html`))) missing.push(`${l}${p}`);
  }
  assert.deepEqual(missing, []);
});

test('the departure rule gives the owner\'s reference times', () => {
  assert.deepEqual(['2026-10-04', '2026-10-25', '2026-12-15', '2027-06-15'].map(sunsetDeparture),
    ['18:30', '17:00', '16:45', '20:00']);
});

test('the browser copies of the rule (tide.js, booking.js) agree with scripts/lib/sunset.mjs', () => {
  for (const f of ['tide.js', 'booking.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const a = src.indexOf('var SUN = (function () {'), b = src.indexOf('\n  })();\n', a);
    assert.ok(a > 0 && b > a, `${f}: no SUN block`);
    const SUN = new Function(src.slice(a, b + 8) + '\nreturn SUN;')();
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 864e5 * 3) {
      const d = new Date(t).toISOString().slice(0, 10);
      assert.equal(SUN.departure(d), sunsetDeparture(d), `${f} ${d}`);
    }
  }
});

test('no single 3 hour window for both day trip lengths', () => {
  // the 2h30 is back at 12:30 / 16:30: "10–13 · 14–17" only fits the 3h
  assert.deepEqual(hits(/10\s?[–—-]\s?13\s?·\s?14\s?[–—-]\s?17|10:00\s?[–—-]\s?13:00|14:00\s?[–—-]\s?17:00/g), []);
});

test('sales pages do not promise a golden hour (the clouds decide the colours)', () => {
  const PAGES = ['index', 'experiences', 'sunset-cruise', 'hidden-coves-half-day', 'private-boat-tour-madeira'];
  const bad = [];
  for (const l of ['', 'fr/', 'de/', 'pt/', 'es/', 'it/']) for (const p of PAGES) {
    const f = path.join(ROOT, `${l}${p}.html`);
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, 'utf8').replace(/(alt|aria-label)="[^"]*"/g, '').replace(/<[^>]+>/g, ' ');
    const m = t.match(/golden hour|heure dorée|goldene[nr]? Stunde|hora dourada|hora dorada|ora d.oro|ora dorata/i);
    if (m) bad.push(`${l}${p}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
