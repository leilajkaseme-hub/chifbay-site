#!/usr/bin/env node
// add-money-links.mjs: links from the Journal to the pages that sell.
//
//   node scripts/add-money-links.mjs           dry run, prints counts
//   node scripts/add-money-links.mjs --write   apply
//   node scripts/add-money-links.mjs --list    dry run, every link it would add
//
// Why: Google ranks our Journal articles, not the trip pages (audit of
// 4 Oct 2026: "sunset cruise funchal" #15 with an article, "faja dos padres
// boat trip" #16 with an article). Almost every article linked only to
// /experiences. This script turns words already in the text into links to the
// page that answers the search (scripts/data/seo-targets.json): a sentence
// about Cabo Girão links "under Cabo Girão" to /cabo-girao-boat-tour, a sunset
// article links "sunset cruise" to /sunset-cruise, a general mention of boat
// trips in Madeira links to the home page.
//
// Rules, all enforced here:
//   - only words inside <p> or <li> of the <article>, never in a heading, a
//     FAQ question, a caption or an existing link; the anchor is the text as
//     written, so anchors vary from article to article
//   - at most 3 links per article (2 under 400 words), never two links to the
//     same page in one article, nothing to a page the article already links to
//   - language matched: a German article links to /de/ pages; pages that exist
//     only in English (Cabo Girão, Fajã dos Padres) get at most one link
//   - a link this script wrote carries data-ml. Each run first takes its own
//     links out, then works from scratch, so a second run changes nothing and
//     a change of rules here rewrites cleanly.
// It also lists the landing pages in the footer "Book" column (between
// <!--routes--> markers), in the languages that have them.
// Run it after anything that writes articles (blog-auto.yml does).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const LIST = process.argv.includes("--list");
const LANGS = ["en", "fr", "de", "pt", "es", "it"];
const home = (l) => (l === "en" ? "/" : `/${l}/`);
const loc = (l, slug) => (l === "en" ? `/${slug}` : `/${l}/${slug}`);

const GIRAO = "Cabo Gir[ãa]o";
// One entry per target page. url(lang) gives the page, or null when the
// language has none. pat[lang] lists patterns, most specific first.
const TARGETS = [
  { id: "faja", enOnly: true, url: () => "/faja-dos-padres-boat-trip",
    pat: { all: [/\b(?:the )?(?:cove|bay|beach|terraces?) (?:at|of) Faj[ãa] dos Padres\b/, /\bFaj[ãa] dos Padres\b/] } },
  { id: "cabo", enOnly: true, url: () => "/cabo-girao-boat-tour",
    pat: {
      en: [new RegExp(`\\b(?:boat (?:tours?|trips?|rides?) (?:to|under|along|past|beneath) ${GIRAO}|${GIRAO} from the (?:sea|water)|(?:the )?(?:base|foot) of ${GIRAO}|under(?:neath)? ${GIRAO}|(?:the )?(?:sea )?cliffs? (?:of|at) ${GIRAO}|${GIRAO}(?:'s)? (?:sea )?cliffs?)\\b`, "i")],
      all: [new RegExp(`\\b${GIRAO}\\b(?! ?[Ss]kywalk)`)],
    } },
  { id: "sunset", url: (l) => loc(l, "sunset-cruise"),
    pat: {
      en: [/\b(?:private )?sunset (?:cruises?|boat (?:trips?|tours?)|sail(?:ing)? trips?|trips?|tours?)\b/i],
      de: [/\b(?:private[nrms]? )?(?:Sonnenuntergangs(?:fahrt|tour|törn|kreuzfahrt|bootsfahrt|bootstour)(?:en)?|Bootsfahrt(?:en)? (?:zum|bei|im) Sonnenuntergang|Fahrt(?:en)? (?:zum|in den) Sonnenuntergang|Bootstour(?:en)? (?:zum|bei|im) Sonnenuntergang)\b/],
      fr: [/\b(?:croisière|sortie|balade|excursion|virée)s? (?:en (?:bateau|mer) )?au coucher (?:du|de) soleil\b/i],
      pt: [/\b(?:passeio|cruzeiro|saída)s? (?:de barco )?ao pôr do sol\b/i],
      es: [/\b(?:paseo|excursión|excursiones|salida|crucero|travesía)s? (?:en barco )?al atardecer\b/i],
      it: [/\b(?:gita|gite|uscita|uscite|crociera|crociere|giro|giri|tour) (?:in barca )?al tramonto\b/i],
    } },
  { id: "day", url: (l) => loc(l, "hidden-coves-half-day"),
    pat: {
      en: [/\b(?:private )?(?:half[- ]day|day) boat trips?\b/i, /\bday trips? by boat\b/i, /\bboat day trips?\b/i, /\bswim(?:ming)? stops?\b/i],
      de: [/\b(?:Halb)?[Tt]agestour(?:en)? mit dem Boot\b/, /\bBadestopps?\b/],
      fr: [/\bsorties? (?:en bateau )?(?:à la journée|de jour)\b/i, /\barrêts? baignade\b/i],
      pt: [/\bpasseios? de barco de dia\b/i, /\bparagem para (?:um )?mergulho\b/i],
      es: [/\bexcursi(?:ón|ones) (?:en barco )?de día\b/i, /\bparadas? para (?:nadar|bañarse)\b/i],
      it: [/\bgit[ae] (?:in barca )?di giorno\b/i, /\bsoste? per (?:il )?bagno\b/i],
    } },
  { id: "private", url: (l) => (l === "en" ? "/private-boat-tour-madeira" : l === "de" || l === "fr" ? `/${l}/private-boat-tour-madeira` : home(l)),
    pat: {
      en: [/\bprivate (?:boat|charter) (?:tours?|trips?|charters?|cruises?|excursions?)(?: (?:in|on|around) Madeira| from Funchal)?\b/i, /\bprivate (?:boat|charter)s?\b/i],
      de: [/\bprivate[nrms]? Boots(?:tour|fahrt|ausflug)(?:en|e)?\b/, /\bPrivatboot(?:e|s)?\b/, /\bprivate[nrms]? Charter\b/],
      fr: [/\b(?:excursion|sortie|balade|croisière)s? en bateau privé\b/i, /\bbateau privé\b/i],
      pt: [/\bpasseios? de barco privados?\b/i, /\bbarcos? privados?\b/i],
      es: [/\b(?:excursi(?:ón|ones)|paseos?|salidas?) en barco privado\b/i, /\bbarcos? privados?\b/i],
      it: [/\bgit[ae] in barca privata\b/i, /\bbarc(?:a|he) privat[ae]\b/i],
    } },
  { id: "home", url: (l) => home(l),
    pat: {
      en: [/\b(?:Madeira|Funchal) boat (?:trips?|tours?)\b/i, /\bboat (?:trips?|tours?) (?:in|around|on|off|from|out of) (?:Madeira|Funchal)\b/i, /\bboat (?:trips?|tours?)\b/i],
      de: [/\bBoots(?:tour|ausflug|fahrt)(?:en|e)? (?:auf|ab|von|in|um) (?:Madeira|Funchal)\b/, /\bBootstour(?:en)?\b/, /\bBootsausfl(?:ug|üge)\b/],
      fr: [/\b(?:excursion|sortie|balade)s? en (?:bateau|mer) (?:à|depuis|autour de) (?:Madère|Funchal)\b/i, /\b(?:excursion|sortie|balade)s? en bateau\b/i],
      pt: [/\bpasseios? de barco (?:na|pela|no|desde o|a partir do) (?:Madeira|Funchal)\b/i, /\bpasseios? de barco\b/i],
      es: [/\b(?:excursi(?:ón|ones)|paseos?|salidas?) en barco (?:en|por|desde) (?:Madeira|Funchal)\b/i, /\b(?:excursi(?:ón|ones)|paseos?|salidas?) en barco\b/i],
      it: [/\b(?:gita|gite|escursion[ei]|uscit[ae]|tour) in barca (?:a|da|intorno a) (?:Madeira|Funchal)\b/i, /\b(?:gita|gite|escursion[ei]|uscit[ae]) in barca\b/i],
    } },
  { id: "rental", enOnly: true, url: (l) => (l === "en" ? "/boat-rental-with-skipper-funchal" : null),
    pat: { en: [/\b(?:boat (?:rentals?|hire)|rent(?:ing)? a boat|hir(?:e|ing) a (?:private )?boat|skippered (?:boats?|charters?)|boats? with (?:a )?skipper)\b/i] } },
  { id: "best", enOnly: true, url: (l) => (l === "en" ? "/best-boat-trips-madeira" : null),
    pat: { en: [/\bbest boat (?:trips?|tours?)(?: in Madeira)?\b/i, /\bwhale[- ]watching (?:trips?|tours?|boats?|operators?)\b/i, /\bshared catamarans?(?: (?:trips?|tours?|cruises?))?\b/i, /\bcatamaran (?:trips?|tours?|cruises?)\b/i] } },
];
// topical pages first; the home page always gets a slot when it has a match
const ORDER = ["faja", "cabo", "sunset", "day", "private", "rental", "best"];

const files = [];
for (const l of LANGS) {
  const dir = l === "en" ? "posts" : `${l}/posts`;
  for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) if (f.endsWith(".html") && f !== "index.html") files.push([l, `${dir}/${f}`]);
}

// normalise any href to a site path, to see what an article already links to
function norm(href, rel) {
  if (/^(mailto|tel|https?:\/\/(?!chifbay\.com))/.test(href) || href.startsWith("#")) return null;
  const u = new URL(href, `https://chifbay.com/${rel}`);
  let p = u.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
  return p || "/";
}

function eligibleTexts(art) {
  // walk the article: text runs that sit in a <p> or <li>, outside links,
  // headings, summaries, captions, buttons and tables
  const out = []; const stack = []; const re = /<(\/?)([a-zA-Z0-9]+)\b[^>]*?(\/?)>|<!--[\s\S]*?-->/g; let last = 0, m;
  const VOID = new Set(["img", "br", "source", "hr", "input", "meta", "link", "wbr"]);
  const bad = () => stack.some((t) => /^(a|h[1-6]|summary|figcaption|button|table|script|style|svg|blockquote)$/.test(t));
  const inBlock = () => stack.some((t) => t === "p" || t === "li");
  while ((m = re.exec(art))) {
    if (m.index > last && inBlock() && !bad()) out.push([last, m.index]);
    last = re.lastIndex;
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (VOID.has(tag) || m[3]) continue;
    if (m[1]) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; }
    else stack.push(tag);
  }
  return out;
}

function findFirst(art, patterns) {
  for (const re of patterns) {
    for (const [a, b] of eligibleTexts(art)) {
      const seg = art.slice(a, b);
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const mm of seg.matchAll(g)) {
        const s = a + mm.index, e = s + mm[0].length;
        // never split an HTML entity, never start or end mid word
        if (/&[a-z#0-9]*$/i.test(art.slice(Math.max(a, s - 8), s))) continue;
        if (/[\p{L}\p{N}]/u.test(art[s - 1] || "") || /[\p{L}\p{N}]/u.test(art[e] || "")) continue;
        // a bold question that opens a paragraph is a FAQ heading in disguise
        const so = art.lastIndexOf("<strong>", s), sc = art.lastIndexOf("</strong>", s);
        if (so > sc) { const close = art.indexOf("</strong>", e); if (close > 0 && /\?\s*$/.test(art.slice(so, close).replace(/<[^>]+>/g, ""))) continue; }
        return [s, e];
      }
    }
  }
  return null;
}

const countMatches = (text, patterns) => patterns.reduce((n, re) => n + (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length, 0);

const perLang = Object.fromEntries(LANGS.map((l) => [l, 0]));
const perTarget = {};
let changedFiles = 0;
const listing = [];

for (const [lang, rel] of files) {
  const before = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const am = before.match(/(<article\b[^>]*>)([\s\S]*?)(<\/article>)/);
  if (!am) continue;
  // our own links out first: every run starts from the article as written
  let art = am[2].replace(/<a href="[^"]*" data-ml>([\s\S]*?)<\/a>/g, "$1");
  const text = art.replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const cap = words < 400 ? 2 : 3;
  const linked = new Set([...art.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((x) => norm(x[1], rel)).filter(Boolean));
  const used = new Set();
  let added = 0, enOnlyUsed = 0;
  const pats = (t) => [...(t.pat[lang] || []), ...(t.pat.all || [])];

  const candidates = TARGETS.map((t) => ({ t, url: t.url(lang), n: countMatches(text, pats(t)) }))
    .filter((c) => c.url && c.n > 0 && !linked.has(c.url) && !(c.t.id === "rental" || c.t.id === "best" ? lang !== "en" : false));
  const topical = candidates.filter((c) => c.t.id !== "home")
    .sort((a, b) => (lang !== "en" ? (a.t.enOnly ? 1 : 0) - (b.t.enOnly ? 1 : 0) : 0) || b.n - a.n || ORDER.indexOf(a.t.id) - ORDER.indexOf(b.t.id));
  const homeC = candidates.find((c) => c.t.id === "home");
  const queue = [...topical.slice(0, 1), ...(homeC ? [homeC] : []), ...topical.slice(1)];

  for (const c of queue) {
    if (added >= cap) break;
    if (used.has(c.url) || linked.has(c.url)) continue;
    if (c.t.enOnly && lang !== "en" && enOnlyUsed >= 1) continue;
    const hit = findFirst(art, pats(c.t));
    if (!hit) continue;
    const [s, e] = hit;
    const anchor = art.slice(s, e);
    art = `${art.slice(0, s)}<a href="${c.url}" data-ml>${anchor}</a>${art.slice(e)}`;
    used.add(c.url); added++;
    if (c.t.enOnly && lang !== "en") enOnlyUsed++;
    perTarget[c.t.id] = (perTarget[c.t.id] || 0) + 1;
    perLang[lang]++;
    listing.push(`${rel}: "${anchor}" -> ${c.url}`);
  }
  const after = before.replace(am[0], am[1] + art + am[3]);
  if (after !== before) { changedFiles++; if (WRITE) fs.writeFileSync(path.join(ROOT, rel), after); }
}

// ---------- footer: the landing pages in the "Book" column ----------
const ROUTES = {
  en: [["/private-boat-tour-madeira", "Private boat tour"], ["/cabo-girao-boat-tour", "Cabo Girão boat tour"], ["/faja-dos-padres-boat-trip", "Fajã dos Padres trip"], ["/boat-rental-with-skipper-funchal", "Boat with skipper"], ["/best-boat-trips-madeira", "Best boat trips compared"]],
  fr: [["/fr/private-boat-tour-madeira", "Excursion en bateau privé"]],
  de: [["/de/private-boat-tour-madeira", "Private Bootstour"]],
};
let footerFiles = 0;
const SKIP = new Set(["node_modules", "scripts", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "assets", "print"]);
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) { walk(rel); continue; }
    if (!e.name.endsWith(".html")) continue;
    const before = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const lang = (before.match(/<html[^>]*lang="([a-z]{2})/) || [])[1] || "en";
    const col = before.match(/<div class="fc"><h3>[^<]*<\/h3>\s*<a href="\/book-day">[\s\S]*?<\/div>/);
    if (!col) continue;
    const clean = col[0].replace(/\n?\s*<!--routes-->[\s\S]*?<!--\/routes-->/, "");
    const r = ROUTES[lang];
    const block = r ? `\n        <!--routes-->${r.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}<!--/routes-->` : "";
    const fixed = r ? clean.replace(/(<a href="\/(?:[a-z]{2}\/)?experiences">[^<]*<\/a>)/, `$1${block}`) : clean;
    const after = before.replace(col[0], fixed);
    if (after !== before) { footerFiles++; if (WRITE) fs.writeFileSync(path.join(ROOT, rel), after); }
  }
})("");

if (LIST) console.log(listing.join("\n"));
console.log(`articles changed: ${changedFiles}; links per language: ${JSON.stringify(perLang)}; per page: ${JSON.stringify(perTarget)}`);
console.log(`footer route links: ${footerFiles} page(s) changed`);
console.log(WRITE ? "WRITTEN" : "DRY RUN (add --write)");
