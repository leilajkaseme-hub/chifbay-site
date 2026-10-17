#!/usr/bin/env node
/**
 * posts-i18n.mjs — translate the Journal articles into every site language.
 *
 * WHY THIS EXISTS
 * ---------------
 * The site had 68 articles, all English only. The place names those articles
 * cover are where the real search volume is, and most of that volume is NOT
 * English. Measured on Semrush, August 2026:
 *
 *     "cabo girao"       22,600/mo worldwide   PT 6,600 · PL 2,900 · DE 2,400
 *                                              FR 1,600 · ES 1,000 · UK 1,000
 *     "faja dos padres"   6,500/mo worldwide   PT 3,600 · DE 590 · FR 390
 *     "madeira boat tour"    70/mo worldwide
 *
 * So English is a few percent of the market, and the phrase the site was built
 * around is worth almost nothing. Translating the articles is the single
 * biggest lever available.
 *
 * scripts/blog-i18n.mjs translates the blog INDEX chrome and deliberately
 * leaves article titles in English, because translating a title that leads to
 * an English page is worse than leaving it alone. That decision was right while
 * the articles were English only. This script removes the reason for it.
 *
 * HOW IT TRANSLATES
 * -----------------
 * Through the `claude` CLI with CLAUDE_CODE_OAUTH_TOKEN — the same token and
 * the same pattern as .github/workflows/blog-auto.yml, which has produced every
 * article on the site. scripts/i18n-build.mjs wants ANTHROPIC_API_KEY instead,
 * and that secret has always been empty, which is why translate.yml has never
 * run. Nothing here needs a key that does not already work.
 *
 * The model is given the text only. Every mechanical part — asset paths,
 * canonical, <html lang>, hreflang, the per-language index, the sitemap — is
 * done in code below, where it can be checked, not left to a prompt.
 *
 * RUN
 * ---
 *   node scripts/posts-i18n.mjs --plan            what is missing, translates nothing
 *   node scripts/posts-i18n.mjs --budget 6        translate 6 missing pairs
 *   node scripts/posts-i18n.mjs --lang fr         restrict to one language
 *   node scripts/posts-i18n.mjs --slug cabo-girao-from-the-sea
 *   node scripts/posts-i18n.mjs --reindex         rebuild indexes + hreflang only
 *
 * A "pair" is one article in one language. 68 articles x 5 languages = 340.
 * The budget exists so a scheduled run is small and safe; --reindex is cheap
 * and always runs at the end.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postUrl } from "./post-url.mjs";
import { skeleton, editableText, articleOf, words, imgSrcs, bgSrcs, ldShape, deadLinks } from "./lib/native-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://chifbay.com";
const EN_POSTS = path.join(ROOT, "posts");

/** Languages that already have a built site section. Adding one here is not
 *  enough on its own — a new language also needs its tour pages, which
 *  i18n-build.mjs / build-tour-locales.mjs produce. */
const LANGS = {
  fr: "French (français de France)",
  de: "German (Deutsch)",
  pt: "European Portuguese (português de Portugal)",
  es: "Spanish (español de España)",
  it: "Italian (italiano)",
};

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const PLAN_ONLY = flag("plan");
const REINDEX_ONLY = flag("reindex");
const BUDGET = Number(value("budget", "6"));
const ONLY_LANG = value("lang");
const ONLY_SLUG = value("slug");
const REWRITE = flag("rewrite");

if (ONLY_LANG && !LANGS[ONLY_LANG]) {
  console.error(`Unknown language "${ONLY_LANG}". Known: ${Object.keys(LANGS).join(", ")}`);
  process.exit(1);
}
if (!Number.isFinite(BUDGET) || BUDGET < 0) {
  console.error(`--budget must be a number >= 0, got "${value("budget")}"`);
  process.exit(1);
}

// ------------------------------------------------------------------ helpers
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const langsInPlay = () => (ONLY_LANG ? [ONLY_LANG] : Object.keys(LANGS));

/** Force every relative asset reference to exactly two hops.
 *
 *  A post lives at /<lang>/posts/<slug>.html, which is two levels below the
 *  site root, so "../../peak.css" is correct and nothing else is.
 *
 *  This used to ADD one hop to whatever came back, which is right only if the
 *  model echoes the English file's single "../". It stopped being right the
 *  moment the first translated sibling existed in the folder: the model read
 *  the neighbours, copied their already-correct "../../", and the add-one step
 *  turned it into "../../../". 23 of the first 41 pages came out that way and
 *  would have rendered with no stylesheet at all.
 *
 *  Setting the depth rather than incrementing it is correct whatever the model
 *  produces, and it repairs a file that is already wrong. Absolute paths
 *  ("/track.js") and full URLs are untouched. */
function deepenPaths(html) {
  return html
    .replace(/(href|src)="(?:\.\.\/)+/g, '$1="../../')
    .replace(/url\((['"]?)(?:\.\.\/)+/g, "url($1../../");
}

function setDocMeta(html, lang, slug) {
  const url = postUrl(ROOT, slug, lang);
  const enUrl = `${BASE}/posts/${slug}.html`;
  let out = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);

  // canonical points at this language's own copy, never at the English one
  out = /<link rel="canonical"/.test(out)
    ? out.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}"/>`)
    : out.replace(/<\/head>/, `<link rel="canonical" href="${url}"/>\n</head>`);

  out = /<meta property="og:url"/.test(out)
    ? out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}"/>`)
    : out.replace(/<\/head>/, `<meta property="og:url" content="${url}"/>\n</head>`);

  out = /<meta property="og:locale"/.test(out)
    ? out.replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${lang}"/>`)
    : out.replace(/<\/head>/, `<meta property="og:locale" content="${lang}"/>\n</head>`);

  // JSON-LD mainEntityOfPage still claims the English URL after translation
  for (const source of [enUrl, enUrl.slice(0, -5)]) {
    out = out.replace(new RegExp(escapeRe(`"mainEntityOfPage":"${source}"`), "g"),
      `"mainEntityOfPage":"${url}"`);
  }

  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** hreflang block covering English + every language that really has the file.
 *  Claiming a translation that does not exist is worse than claiming none. */
function hreflangBlock(slug) {
  const rows = [`<link rel="alternate" hreflang="en" href="${postUrl(ROOT, slug)}"/>`];
  for (const lang of Object.keys(LANGS)) {
    if (fs.existsSync(path.join(ROOT, lang, "posts", `${slug}.html`))) {
      rows.push(`<link rel="alternate" hreflang="${lang}" href="${postUrl(ROOT, slug, lang)}"/>`);
    }
  }
  rows.push(`<link rel="alternate" hreflang="x-default" href="${postUrl(ROOT, slug)}"/>`);
  return rows.join("\n");
}

const HREF_START = "<!--hreflang:posts-i18n-->";
const HREF_END = "<!--/hreflang:posts-i18n-->";

function applyHreflang(html, slug) {
  const block = `${HREF_START}\n${hreflangBlock(slug)}\n${HREF_END}`;
  const existing = new RegExp(`${escapeRe(HREF_START)}[\\s\\S]*?${escapeRe(HREF_END)}`);
  return existing.test(html)
    ? html.replace(existing, block)
    : html.replace(/<\/head>/, `${block}\n</head>`);
}

// ------------------------------------------------------- native articles
// Theo, 17 Oct 2026: "make each article in the unique language, not just a
// simple translation, an article based on the language". Until then the model
// was told to keep the structure, length and every fact "exactly": German
// readers got the English article word for word (long dashes, the same photo
// caption on every picture). On 4 Oct the German, French and Portuguese
// articles lost half their Google clicks while the English ones grew.
//
// So each language now gets its OWN article on the same subject: own title,
// own angle, own sections, built on what readers of that language really
// search (the Search Console queries in scripts/data/native-queue.json). The
// English article is the source of FACTS, not of sentences.
//
// The model writes text. Code checks everything else and refuses the file
// when one check fails (the old version is put back):
//   - outside the editable parts (head text, JSON-LD text, <h1>, the reading
//     time, the <article>), the page is byte for byte what it was;
//   - same photos (same src), JSON-LD still parses with the same structure;
//   - no long dash, enough words, every internal link points to a real page.

// The full-page translation (menu, footer, every interface text) is still how a
// missing language is CREATED; the article in it is then rewritten natively.
const SYSTEM = (langName) => `You are a senior NATIVE COPYWRITER and SEO localizer for a premium travel brand. You localize one article from the Journal of Chifbay — a private boat charter company in Funchal, Madeira, Portugal — into ${langName}.

Write as if a top native writer wrote it directly in ${langName}. Idiomatic, warm, concrete. Never word-for-word. Keep the article's structure, length and every fact exactly as they are — this is a localization, not a rewrite, and not a summary.

SEO matters here more than anything. This article exists to rank in ${langName} for the places it describes. Localize <title>, meta description, Open Graph and Twitter text, image alt text and any keywords using the REAL phrases people search in ${langName} (German "Bootstour Madeira", "Cabo Girão Aussichtsplattform"; French "excursion bateau Madère", "falaise Cabo Girão"; Portuguese "passeio de barco Madeira", "miradouro do Cabo Girão"). Meta descriptions stay between 150 and 158 characters, and the <title> stays at most 62 characters in total (main keyword first; drop " | Chifbay" if it does not fit).

You are given a complete HTML document. Return the EXACT same HTML with ONLY the human-readable text translated.

STRICT RULES — breaking any one of these makes the output useless:
- Never modify a tag, attribute name, class, id, href, src, inline style, or any <script> code.
- In JSON-LD, translate string VALUES only (headline, description, name, FAQ question and answer text, alt). Never touch keys, "@type", "@context", URLs, or dates.
- Never translate or alter: "Chifbay"; place names (Funchal, Madeira, Cabo Girão, Câmara de Lobos, Fajã dos Padres, Ponta do Sol, Ribeira Brava, Marina do Funchal, Desertas, Pico do Arieiro, Seixal, Garajau, Machico, Santana); "poncha", "espetada", "Nikita", "levada"; boat words "Karnic", "Mercury"; any price, number, unit or time (€400, 2h30, 18:30, 580 m, 5 guests); phone numbers; emails; URLs; "@chifbay".
- Keep every <link>, <meta>, <script> and HTML comment in place, in the same order.
- Output ONLY the complete HTML document. No preamble, no explanation, no code fences.`;

function translateOne(slug, lang) {
  const src = path.join(EN_POSTS, `${slug}.html`);
  const outDir = path.join(ROOT, lang, "posts");
  const out = path.join(outDir, `${slug}.html`);
  fs.mkdirSync(outDir, { recursive: true });

  const prompt = [
    SYSTEM(LANGS[lang]),
    "",
    `Read the file "posts/${slug}.html".`,
    `Write the localized document to "${lang}/posts/${slug}.html".`,
    "Write the file with the Write tool. Do not print the HTML in your reply.",
  ].join("\n");

  execFileSync(
    "claude",
    ["-p", prompt, "--permission-mode", "acceptEdits",
     "--allowedTools", "Read", "Write"],
    { cwd: ROOT, stdio: "inherit", timeout: 15 * 60 * 1000 },
  );

  if (!fs.existsSync(out)) throw new Error(`claude did not write ${lang}/posts/${slug}.html`);

  let html = fs.readFileSync(out, "utf8");
  if (!/<\/html>/i.test(html)) throw new Error(`${lang}/posts/${slug}.html looks truncated`);

  // Mechanical fixes belong here, not in the prompt.
  html = deepenPaths(html);
  html = setDocMeta(html, lang, slug);
  fs.writeFileSync(out, html);

  // Sanity: the English source is the only place the real asset list exists.
  const enImgs = (fs.readFileSync(src, "utf8").match(/<img\b/g) || []).length;
  const outImgs = (html.match(/<img\b/g) || []).length;
  if (enImgs !== outImgs) {
    console.warn(`  ! ${lang}/${slug}: ${enImgs} images in English, ${outImgs} here — check it`);
  }
}


/** Who reads each language, so the article is written for them. */
const READERS = {
  fr: "readers from France, Belgium and Switzerland. Address them as \"vous\". They search things like \"que faire à Madère\", \"incontournables\", \"où manger\".",
  de: "readers from Germany, Austria and Switzerland. Address them as \"Sie\". They plan carefully and want practical detail: how to get there, how long it takes, what it costs, when to go, Tipps and Sehenswürdigkeiten.",
  pt: "readers of European Portuguese: people from mainland Portugal, the Portuguese abroad and Madeirans themselves. Use pt-PT words and spelling (autocarro, pequeno-almoço, telemóvel), never Brazilian forms. Do not explain to them what any Portuguese already knows; give them what is special about Madeira.",
  es: "readers from Spain. Address them as \"usted\" like the rest of the Spanish site. They search things like \"qué ver en Madeira\", \"qué hacer\", \"dónde comer\".",
  it: "readers from Italy. Address them with \"voi\" like the rest of the Italian site. They search things like \"cosa vedere a Madeira\", \"cosa fare\", \"quanti giorni\".",
};

/** Facts about Chifbay that an article may state, and must never contradict. */
const FACTS = [
  "Chifbay is a private boat company in Funchal, Madeira: the whole boat for one group only, up to 5 guests, two licensed skippers from Madeira, a 2026 Karnic R8S.",
  "Meeting point: Marina do Funchal, Pontoon C.",
  "Day trip: leaves at 10:00 or 14:00. 2 h 30 to Ribeira Brava for 500 EUR, or 3 h on to Ponta do Sol for 600 EUR. Câmara de Lobos, Cabo Girão, a swim and paddle boards at Fajã dos Padres.",
  "Sunset trip: leaves 1 h 15 before sunset, all year. 2 h to Cabo Girão for 400 EUR, or 2 h 30 to Ribeira Brava for 500 EUR. No swim stop.",
  "Prices are for the whole boat, never per person.",
  "Every trip includes food and drinks on board, an Insta360 360° video, drone footage (weather allowing) and photos taken with a real camera.",
  "Free cancellation up to 24 hours before departure.",
  "Never promise dolphins, whales, golden light or good weather: they are a gift when they happen.",
];

/** Chifbay pages that exist in this language, for the model to link to. */
function langPages(lang) {
  return ["", "experiences", "sunset-cruise", "hidden-coves-half-day", "private-boat-tour-madeira", "practical", "blog", "reviews"]
    .filter((n) => fs.existsSync(path.join(ROOT, lang, n ? `${n}.html` : "index.html")))
    .map((n) => `/${lang}/${n}`);
}

const OUT_DIR = path.join(ROOT, "native-out");     // scratch, never committed

function brief(slug, lang, queries) {
  const name = LANGS[lang];
  const file = `${lang}/posts/${slug}.html`;
  const out = `native-out/${lang}-${slug}.txt`;
  return [
    `You are a top native ${name} travel journalist. You write for the Journal of Chifbay, a private boat company in Funchal, Madeira, Portugal. Your readers are ${READERS[lang]}`,
    "",
    `TASK: write a NEW article in ${name} on the same subject as the English article "posts/${slug}.html". It is NOT a translation. Think about what this reader types into Google on this subject, what they already know, what they want to find out, and what makes them trust a page. Then write the article the best ${name} travel writer would write for them: your own title, your own heading, your own opening, your own section headings and order. Add what this reader needs (practical details, when to go, how it compares) and drop what does not matter to them. Use the English article only as the source of facts. Do NOT reuse its headings, its section order or its sentences: a reader who knows both languages must see two different articles on the same subject. A list article may keep the same places, but choose your own order, your own reasons and your own headings for this reader.`,
    queries && queries.length
      ? `\nThese real Google searches in ${name} already find this page: ${queries.map((q) => `"${q}"`).join(", ")}. Use their words naturally in the title, the heading, the first paragraph and one or two section headings. Write for people, not for keywords.`
      : `\nPick the words a native ${name} speaker really types into Google for this subject, and use them naturally in the title, the heading, the first paragraph and one or two section headings.`,
    "",
    "FACTS: state only facts that are in the English article, in the Chifbay facts below, or that you are certain of. Never invent a price, time, distance, date, name or record. When unsure, leave it out.",
    "Chifbay facts (never contradict them):",
    ...FACTS.map((f) => `- ${f}`),
    "",
    "STYLE: natural, idiomatic, warm and concrete, short paragraphs. NEVER use a long dash (— or –) anywhere: use a comma, a colon or a full stop. No hype words.",
    "LENGTH: at least as long as the English article; longer when the reader needs more.",
    `LINKS: you may link to these Chifbay pages in ${name}: ${langPages(lang).join(", ")} (and keep the links the current version has to other Chifbay pages).`,
    "",
    `Read "${file}" (the current page: copy its <figure> blocks from there) and "posts/${slug}.html" (the English source of facts).`,
    `Then write a plain text file "${out}" with the Write tool, with exactly these sections, each starting on its own line with the marker:`,
    "=== TITLE ===            the page title, under 62 characters, no brand name",
    "=== DESCRIPTION ===      the meta description, under 155 characters",
    "=== SOCIAL_TITLE ===     the title for social sharing (can be a little longer)",
    "=== SOCIAL_DESCRIPTION === one or two sentences for social sharing",
    "=== IMAGE_ALT ===        what the header photo shows, in the language",
    "=== H1 ===               the heading at the top of the page (plain text)",
    "=== READING_TIME ===     the reading time in the language, e.g. \"8 Min. Lesezeit\"",
    "=== ARTICLE ===          the HTML of the article body: <p class=\"lede\"> first, then <h2>, <h3>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <a>, <blockquote> and the <figure> blocks. Copy every <figure> block of the current page with the same <picture>, <source> and <img> src/srcset, and write a new specific alt text and <figcaption> saying what the photo shows. Do not add other photos, scripts or styles.",
    "=== FAQ ===              3 to 5 questions real readers in this language ask, each as two lines: \"Q: ...\" then \"A: ...\"",
    "Do not print the article in your reply.",
  ].join("\n");
}

/** The model's text file, as { TITLE, DESCRIPTION, ..., FAQ: [[q, a]] }. */
function readSections(file) {
  const txt = fs.readFileSync(file, "utf8").replace(/\r/g, "");
  const out = {};
  const re = /^===\s*([A-Z0-9_]+)\s*===[^\n]*\n([\s\S]*?)(?=^===\s*[A-Z0-9_]+\s*===|(?![\s\S]))/gm;
  for (const m of txt.matchAll(re)) out[m[1]] = m[2].trim();
  for (const k of ["TITLE", "DESCRIPTION", "SOCIAL_TITLE", "SOCIAL_DESCRIPTION", "IMAGE_ALT", "H1", "READING_TIME", "ARTICLE", "FAQ"]) {
    if (!out[k]) throw new Error(`section ${k} missing`);
  }
  const faq = [];
  for (const m of out.FAQ.matchAll(/^Q:\s*(.+)\n+A:\s*([\s\S]+?)(?=\n+Q:|$)/gm)) faq.push([m[1].trim(), m[2].trim().replace(/\s+/g, " ")]);
  if (faq.length < 2) throw new Error("FAQ needs at least 2 questions");
  out.FAQ = faq;
  if (out.TITLE.length > 70) throw new Error(`title too long (${out.TITLE.length})`);
  if (out.DESCRIPTION.length > 170) throw new Error(`description too long (${out.DESCRIPTION.length})`);
  return out;
}

const attr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Put the new text into the page. Only the editable parts move. */
function assemble(html, t) {
  const setMeta = (h, re, val) => h.replace(re, (m) => m.replace(/content="[^"]*"/, `content="${attr(val)}"`));
  let h = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${text(t.TITLE)}</title>`);
  h = setMeta(h, /<meta name="description" content="[^"]*"\s*\/?>/, t.DESCRIPTION);
  h = setMeta(h, /<meta property="og:title" content="[^"]*"\s*\/?>/, t.SOCIAL_TITLE);
  h = setMeta(h, /<meta property="og:description" content="[^"]*"\s*\/?>/, t.SOCIAL_DESCRIPTION);
  h = setMeta(h, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, t.SOCIAL_TITLE);
  h = setMeta(h, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, t.SOCIAL_DESCRIPTION);
  h = setMeta(h, /<meta property="og:image:alt" content="[^"]*"\s*\/?>/, t.IMAGE_ALT);
  h = setMeta(h, /<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/, t.IMAGE_ALT);
  h = h.replace(/<div class="hbg"[^>]*>/, (m) => / aria-label="/.test(m) ? m.replace(/ aria-label="[^"]*"/, ` aria-label="${attr(t.IMAGE_ALT)}"`) : m);
  h = h.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, (m, a, b) => a + text(t.H1) + b);
  // reading time: the span that holds a number of minutes
  h = h.replace(/(<div class="artmeta[^"]*"[^>]*>[\s\S]*?)<span>[^<]*\d+[^<]*(?:min|Min)[^<]*<\/span>/i, (m, a) => `${a}<span>${text(t.READING_TIME)}</span>`);
  h = h.replace(/(<article\b[^>]*>)[\s\S]*?(<\/article>)/, (m, a, b) => `${a}\n      ${t.ARTICLE.trim()}\n    ${b}`);
  h = h.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, body, b) => {
    const d = JSON.parse(body);
    for (const n of d["@graph"] || [d]) {
      const types = [].concat(n["@type"] || []);
      if (types.some((x) => /Posting|Article/.test(x))) { n.headline = t.H1; n.description = t.DESCRIPTION; if (n.image && typeof n.image === "object" && !Array.isArray(n.image)) { if ("caption" in n.image) n.image.caption = t.IMAGE_ALT; if ("description" in n.image) n.image.description = t.IMAGE_ALT; } }
      if (types.includes("FAQPage") && Array.isArray(n.mainEntity) && n.mainEntity.length) {
        const proto = n.mainEntity[0];
        n.mainEntity = t.FAQ.map(([q, ans]) => ({ ...proto, name: q, acceptedAnswer: { ...proto.acceptedAnswer, text: ans } }));
      }
    }
    return a + (body.startsWith("\n") ? "\n" : "") + JSON.stringify(d) + (body.endsWith("\n") ? "\n" : "") + b;
  });
  return h;
}

const DONE_FILE = path.join(ROOT, "scripts/data/native-done.json");
const readDone = () => (fs.existsSync(DONE_FILE) ? readJSON(DONE_FILE) : {});
function markDone(slug, lang) {
  const d = readDone();
  d[`${lang}/${slug}`] = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DONE_FILE, JSON.stringify(Object.fromEntries(Object.entries(d).sort()), null, 1) + "\n");
}

/** Replace one language's article with a native one (the page must exist). */
function writeNative(slug, lang, queries = []) {
  const out = path.join(ROOT, lang, "posts", `${slug}.html`);
  if (!fs.existsSync(out)) throw new Error("nothing to rewrite");
  const before = fs.readFileSync(out, "utf8");
  const en = fs.readFileSync(path.join(EN_POSTS, `${slug}.html`), "utf8");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const txt = path.join(OUT_DIR, `${lang}-${slug}.txt`);
  if (fs.existsSync(txt)) fs.unlinkSync(txt);

  execFileSync(
    "claude",
    ["-p", brief(slug, lang, queries), "--permission-mode", "acceptEdits",
     "--allowedTools", "Read", "Write"],
    { cwd: ROOT, stdio: "inherit", timeout: 15 * 60 * 1000 },
  );
  if (!fs.existsSync(txt)) throw new Error("claude wrote no text file");

  const t = readSections(txt);
  let html = assemble(before, t);
  html = deepenPaths(html);
  html = setDocMeta(html, lang, slug);

  // The page around the article must be what it was; the rest is checked too.
  if (skeleton(html) !== skeleton(before)) throw new Error("changed something outside the article and its head text");
  if (imgSrcs(html) !== imgSrcs(before)) throw new Error("the article photos are not the same");
  if (bgSrcs(html) !== bgSrcs(before)) throw new Error("the header photo changed");
  if (ldShape(html) !== ldShape(before)) throw new Error("JSON-LD structure changed (or does not parse)");
  if (/[—–]/.test(editableText(html))) throw new Error("long dash in the new text");
  if (/<(?:script|style|iframe)\b/i.test(t.ARTICLE)) throw new Error("script or style inside the article");
  const enWords = words(articleOf(en)), newWords = words(articleOf(html));
  if (newWords < 0.7 * enWords) throw new Error(`too short: ${newWords} words, English ${enWords}`);
  const dead = deadLinks(ROOT, articleOf(html), lang);
  if (dead.length) throw new Error(`links to pages that do not exist: ${dead.slice(0, 3).join(", ")}`);

  fs.writeFileSync(out, html);
  fs.unlinkSync(txt);
  markDone(slug, lang);
  return newWords;
}

/** The next translated articles to rewrite, most Google views first. */
function rewritePairs() {
  const queue = readJSON(path.join(ROOT, "scripts/data/native-queue.json")).pairs;
  const done = readDone();
  // articles that came after the queue was made go at the end
  const known = new Set(queue.map((e) => `${e.lang}/${e.slug}`));
  for (const lang of Object.keys(LANGS)) {
    const dir = path.join(ROOT, lang, "posts");
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html") && !known.has(`${lang}/${f.slice(0, -5)}`)) queue.push({ slug: f.slice(0, -5), lang, impressions: 0, queries: [] });
    }
  }
  return queue.filter((e) => !done[`${e.lang}/${e.slug}`]
    && (!ONLY_LANG || e.lang === ONLY_LANG) && (!ONLY_SLUG || e.slug === ONLY_SLUG)
    && fs.existsSync(path.join(ROOT, e.lang, "posts", `${e.slug}.html`)));
}

// ------------------------------------------------------------- per-lang index
/** Rebuild /<lang>/posts/posts.json from the files that really exist, reading
 *  each translated title and description out of the document itself. The index
 *  can therefore never promise an article that is not there. */
function rebuildIndex(lang) {
  const enIndex = readJSON(path.join(EN_POSTS, "posts.json"));
  const dir = path.join(ROOT, lang, "posts");
  if (!fs.existsSync(dir)) return 0;

  const rows = [];
  for (const post of enIndex) {
    const file = path.join(dir, `${post.slug}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const title = (html.match(/<meta property="og:title" content="([^"]*)"/) ||
                   html.match(/<title>([^<]*?)(?:\s*\|\s*Chifbay)?<\/title>/) || [])[1];
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    rows.push({
      ...post,
      title: title ? decodeEntities(title) : post.title,
      description: desc ? decodeEntities(desc) : post.description,
      lang,
    });
  }
  fs.writeFileSync(path.join(dir, "posts.json"), JSON.stringify(rows, null, 2) + "\n");
  return rows.length;
}

const decodeEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

// ------------------------------------------------------------------ sitemap
/** Add every translated article to sitemap.xml, next to the English one it
 *  came from. Rewrites only the block this script owns, so hand-written and
 *  bot-written entries elsewhere in the file survive untouched. */
function updateSitemap() {
  const file = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(file)) return 0;
  const xml = fs.readFileSync(file, "utf8");

  const urls = [];
  for (const lang of Object.keys(LANGS)) {
    const dir = path.join(ROOT, lang, "posts");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".html")) urls.push(postUrl(ROOT, f.slice(0, -5), lang));
    }
  }
  urls.sort();

  const START = "  <!--posts-i18n-->";
  const END = "  <!--/posts-i18n-->";
  // a rewritten article carries the day it was rewritten, so Google comes back to it
  const done = readDone();
  const day = (u) => { const m = u.match(/chifbay\.com\/(\w\w)\/posts\/([a-z0-9-]+)/); return m && done[`${m[1]}/${m[2]}`]; };
  const body = urls.map((u) => day(u) ? `  <url><loc>${u}</loc><lastmod>${day(u)}</lastmod></url>` : `  <url><loc>${u}</loc></url>`).join("\n");
  const block = `${START}\n${body}\n${END}`;

  const existing = new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`);
  const next = existing.test(xml)
    ? xml.replace(existing, block)
    : xml.replace(/<\/urlset>/, `${block}\n</urlset>`);

  fs.writeFileSync(file, next);
  return urls.length;
}

// --------------------------------------------------------------------- plan
function missingPairs() {
  const index = readJSON(path.join(EN_POSTS, "posts.json"));
  const slugs = index
    .map((p) => p.slug)
    .filter((s) => fs.existsSync(path.join(EN_POSTS, `${s}.html`)))
    .filter((s) => !ONLY_SLUG || s === ONLY_SLUG);

  const pairs = [];
  for (const slug of slugs) {
    for (const lang of langsInPlay()) {
      if (!fs.existsSync(path.join(ROOT, lang, "posts", `${slug}.html`))) {
        pairs.push({ slug, lang });
      }
    }
  }
  return pairs;
}

/** Refresh hreflang on the English originals and on everything translated, so
 *  each language points at all the others. Runs every time, costs nothing. */
function refreshHreflang() {
  const index = readJSON(path.join(EN_POSTS, "posts.json"));
  let touched = 0;
  for (const { slug } of index) {
    const files = [path.join(EN_POSTS, `${slug}.html`)];
    for (const lang of Object.keys(LANGS)) {
      const f = path.join(ROOT, lang, "posts", `${slug}.html`);
      if (fs.existsSync(f)) files.push(f);
    }
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const before = fs.readFileSync(f, "utf8");
      const after = applyHreflang(before, slug);
      if (after !== before) { fs.writeFileSync(f, after); touched++; }
    }
  }
  return touched;
}

// --------------------------------------------------------------------- main
function main() {
  const pairs = missingPairs();
  const total = readJSON(path.join(EN_POSTS, "posts.json")).length * langsInPlay().length;

  console.log(`${total - pairs.length}/${total} article translations already on disk.`);

  if (PLAN_ONLY) {
    const byLang = {};
    for (const p of pairs) byLang[p.lang] = (byLang[p.lang] || 0) + 1;
    for (const lang of langsInPlay()) console.log(`  ${lang}: ${byLang[lang] || 0} missing`);
    console.log(`\n${pairs.length} to go. At --budget 6 a day that is ${Math.ceil(pairs.length / 6)} days.`);
    return;
  }

  // --rewrite: turn existing translations into native articles, most viewed first.
  // Otherwise: write the missing languages of new articles, natively too.
  const jobs = REINDEX_ONLY || BUDGET <= 0 ? []
    : REWRITE ? rewritePairs().slice(0, BUDGET).map((e) => ({ ...e, mode: "rewrite" }))
    : pairs.slice(0, BUDGET).map((e) => ({ ...e, mode: "new", queries: [] }));
  if (!fs.existsSync(path.join(ROOT, ".gitignore")) || !fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").includes("native-out/")) {
    fs.appendFileSync(path.join(ROOT, ".gitignore"), "\nnative-out/\n");
  }
  if (jobs.length) {
    if (REWRITE) console.log(`${rewritePairs().length} translated articles still to rewrite natively`);
    console.log(`writing ${jobs.length} native article(s) (budget ${BUDGET})\n`);
    let done = 0;
    for (const { slug, lang, mode, queries } of jobs) {
      process.stdout.write(`  ${lang}  ${slug} (${mode}) … `);
      try {
        if (mode === "new") translateOne(slug, lang);   // creates the page with its menu and footer in the language
        const n = writeNative(slug, lang, queries);
        done++;
        console.log(`ok, ${n} words`);
      } catch (err) {
        // One bad article must not cost the whole run: the rest still land.
        console.log(`FAILED: ${err.message}`);
        if (/usage limit|rate limit|quota/i.test(String(err.message))) break;
      }
    }
    console.log(`\nwritten ${done}/${jobs.length}`);
  }

  for (const lang of Object.keys(LANGS)) {
    const n = rebuildIndex(lang);
    if (n) console.log(`index ${lang}: ${n} articles`);
  }
  console.log(`hreflang: ${refreshHreflang()} files updated`);
  console.log(`sitemap: ${updateSitemap()} translated articles listed`);
}

main();
