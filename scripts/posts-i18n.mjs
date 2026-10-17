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

function brief(slug, lang, mode, queries) {
  const name = LANGS[lang];
  const file = `${lang}/posts/${slug}.html`;
  return [
    `You are a top native ${name} travel journalist. You write for the Journal of Chifbay, a private boat company in Funchal, Madeira, Portugal. Your readers are ${READERS[lang]}`,
    "",
    `TASK: write a NEW article in ${name} on the same subject as the English article "posts/${slug}.html". It is NOT a translation. Think about what this reader types into Google on this subject, what they already know, what they want to find out, and what makes them trust a page. Then write the article the best ${name} travel writer would write for them: your own title, your own <h1>, your own opening, your own section headings and order. Add what this reader needs (practical details, when to go, how it compares) and drop what does not matter to them. Use the English article only as the source of facts.`,
    queries && queries.length
      ? `\nThese real Google searches in ${name} already find this page: ${queries.map((q) => `"${q}"`).join(", ")}. Use their words naturally in the <title>, the <h1>, the first paragraph and one or two headings. Write for people, not for keywords.`
      : `\nPick the words a native ${name} speaker really types into Google for this subject, and use them naturally in the <title>, the <h1>, the first paragraph and one or two headings.`,
    "",
    "FACTS: state only facts that are in the English article, in the Chifbay facts below, or that you are certain of. Never invent a price, time, distance, date, name or record. When unsure, leave it out.",
    "Chifbay facts (never contradict them):",
    ...FACTS.map((f) => `- ${f}`),
    "",
    "STYLE: natural, idiomatic, warm and concrete, short paragraphs. NEVER use a long dash (— or –) anywhere: use a comma, a colon or a full stop. No hype words. The <title> stays under 62 characters, the meta description under 155.",
    "LENGTH: at least as long as the English article; longer when the reader needs more.",
    "PHOTOS: keep every <figure>, <picture> and <img> of the article with exactly the same src and srcset paths. You may move them to where they fit best. Write a new, specific alt text and caption in the language that says what the photo shows.",
    `LINKS: keep the links to Chifbay pages and point them at the ${name} pages. Pages you may link to: ${langPages(lang).join(", ")}.`,
    "JSON-LD: change only the text values (headline, description, FAQ question and answer text) so they match your new article; write 3 to 5 FAQ items that real readers in this language ask. Never touch keys, @type, URLs, dates or images.",
    "",
    mode === "rewrite"
      ? [
          `Read "${file}" (the current version) and "posts/${slug}.html" (the English source of facts).`,
          `Then write the new version to "${file}" with the Write tool. In that file change ONLY: <title>, the meta description, og:title, og:description, og:image:alt, twitter:image:alt, the JSON-LD scripts, the aria-label of the <div class="hbg">, the <h1>, the reading time inside <div class="artmeta">, and everything inside <article class="article ...">...</article>. Everything else (head links and scripts, menu, header, the call to action after the article, footer) must stay byte for byte as it is.`,
        ].join("\n")
      : [
          `Read "posts/${slug}.html" (the English source of facts, and the page template).`,
          `Write the complete page to "${file}" with the Write tool: the same HTML document with the menu, footer and every other interface text in ${name}, and your new article in place of the English one. Never change a tag, attribute, class, id, href to another site, src, inline style or script code outside the article.`,
        ].join("\n"),
    "Do not print the HTML in your reply.",
  ].join("\n");
}

const DONE_FILE = path.join(ROOT, "scripts/data/native-done.json");
const readDone = () => (fs.existsSync(DONE_FILE) ? readJSON(DONE_FILE) : {});
function markDone(slug, lang) {
  const d = readDone();
  d[`${lang}/${slug}`] = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DONE_FILE, JSON.stringify(Object.fromEntries(Object.entries(d).sort()), null, 1) + "\n");
}

/** Write one native article. mode "new": no file yet; "rewrite": replace the translation. */
function writeNative(slug, lang, mode, queries = []) {
  const src = path.join(EN_POSTS, `${slug}.html`);
  const outDir = path.join(ROOT, lang, "posts");
  const out = path.join(outDir, `${slug}.html`);
  fs.mkdirSync(outDir, { recursive: true });
  const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
  if (mode === "rewrite" && !before) throw new Error("nothing to rewrite");
  const en = fs.readFileSync(src, "utf8");

  execFileSync(
    "claude",
    ["-p", brief(slug, lang, mode, queries), "--permission-mode", "acceptEdits",
     "--allowedTools", "Read", "Write"],
    { cwd: ROOT, stdio: "inherit", timeout: 15 * 60 * 1000 },
  );

  const putBack = () => { if (before !== null) fs.writeFileSync(out, before); else if (fs.existsSync(out)) fs.unlinkSync(out); };
  try {
    if (!fs.existsSync(out)) throw new Error("claude wrote nothing");
    let html = fs.readFileSync(out, "utf8");
    if (before !== null && html === before) throw new Error("the file did not change");
    if (!/<\/html>/i.test(html)) throw new Error("looks truncated");

    // Mechanical fixes belong here, not in the prompt.
    html = deepenPaths(html);
    html = setDocMeta(html, lang, slug);

    const ref = mode === "rewrite" ? before : en;
    if (mode === "rewrite" && skeleton(html) !== skeleton(before)) throw new Error("changed something outside the article and its head text");
    if (!new RegExp(`<html lang="${lang}"`).test(html)) throw new Error("wrong <html lang>");
    if (imgSrcs(html) !== imgSrcs(ref)) throw new Error("the article photos are not the same");
    if (bgSrcs(html) !== bgSrcs(ref)) throw new Error("the header photo changed");
    if (ldShape(html) !== ldShape(ref)) throw new Error("JSON-LD structure changed (or does not parse)");
    if (/[—–]/.test(editableText(html))) throw new Error("long dash in the new text");
    const enWords = words(articleOf(en)), newWords = words(articleOf(html));
    if (newWords < 0.7 * enWords) throw new Error(`too short: ${newWords} words, English ${enWords}`);
    const dead = deadLinks(ROOT, articleOf(html), lang);
    if (dead.length) throw new Error(`links to pages that do not exist: ${dead.slice(0, 3).join(", ")}`);

    fs.writeFileSync(out, html);
    markDone(slug, lang);
    return newWords;
  } catch (err) {
    putBack();
    throw err;
  }
}

/** The next translated articles to rewrite, most Google views first. */
function rewritePairs() {
  const queue = readJSON(path.join(ROOT, "scripts/data/native-queue.json")).pairs;
  const done = readDone();
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
  if (jobs.length) {
    if (REWRITE) console.log(`${rewritePairs().length} translated articles still to rewrite natively`);
    console.log(`writing ${jobs.length} native article(s) (budget ${BUDGET})\n`);
    let done = 0;
    for (const { slug, lang, mode, queries } of jobs) {
      process.stdout.write(`  ${lang}  ${slug} (${mode}) … `);
      try {
        const n = writeNative(slug, lang, mode, queries);
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
