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

/** Articles live one level deeper under /<lang>/posts/, so every relative hop
 *  out of the file gains one "../". Absolute paths ("/track.js") are already
 *  correct and must not be touched. */
function deepenPaths(html) {
  return html
    .replace(/(href|src)="\.\.\//g, '$1="../../')
    .replace(/url\(['"]?\.\.\//g, "url('../../");
}

function setDocMeta(html, lang, slug) {
  const url = `${BASE}/${lang}/posts/${slug}.html`;
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
  out = out.replace(new RegExp(escapeRe(`"mainEntityOfPage":"${enUrl}"`), "g"),
    `"mainEntityOfPage":"${url}"`);

  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** hreflang block covering English + every language that really has the file.
 *  Claiming a translation that does not exist is worse than claiming none. */
function hreflangBlock(slug) {
  const rows = [`<link rel="alternate" hreflang="en" href="${BASE}/posts/${slug}.html"/>`];
  for (const lang of Object.keys(LANGS)) {
    if (fs.existsSync(path.join(ROOT, lang, "posts", `${slug}.html`))) {
      rows.push(`<link rel="alternate" hreflang="${lang}" href="${BASE}/${lang}/posts/${slug}.html"/>`);
    }
  }
  rows.push(`<link rel="alternate" hreflang="x-default" href="${BASE}/posts/${slug}.html"/>`);
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

// -------------------------------------------------------------- translation
const SYSTEM = (langName) => `You are a senior NATIVE COPYWRITER and SEO localizer for a premium travel brand. You localize one article from the Journal of Chifbay — a private boat charter company in Funchal, Madeira, Portugal — into ${langName}.

Write as if a top native writer wrote it directly in ${langName}. Idiomatic, warm, concrete. Never word-for-word. Keep the article's structure, length and every fact exactly as they are — this is a localization, not a rewrite, and not a summary.

SEO matters here more than anything. This article exists to rank in ${langName} for the places it describes. Localize <title>, meta description, Open Graph and Twitter text, image alt text and any keywords using the REAL phrases people search in ${langName} (German "Bootstour Madeira", "Cabo Girão Aussichtsplattform"; French "excursion bateau Madère", "falaise Cabo Girão"; Portuguese "passeio de barco Madeira", "miradouro do Cabo Girão"). Meta descriptions stay under ~155 characters.

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
      if (f.endsWith(".html")) urls.push(`${BASE}/${lang}/posts/${f}`);
    }
  }
  urls.sort();

  const START = "  <!--posts-i18n-->";
  const END = "  <!--/posts-i18n-->";
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
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

  if (!REINDEX_ONLY && pairs.length && BUDGET > 0) {
    const todo = pairs.slice(0, BUDGET);
    console.log(`translating ${todo.length} (budget ${BUDGET})\n`);
    let done = 0;
    for (const { slug, lang } of todo) {
      process.stdout.write(`  ${lang}  ${slug} … `);
      try {
        translateOne(slug, lang);
        done++;
        console.log("ok");
      } catch (err) {
        // One bad article must not cost the whole run — the rest still land.
        console.log(`FAILED — ${err.message}`);
      }
    }
    console.log(`\ntranslated ${done}/${todo.length}`);
  }

  for (const lang of Object.keys(LANGS)) {
    const n = rebuildIndex(lang);
    if (n) console.log(`index ${lang}: ${n} articles`);
  }
  console.log(`hreflang: ${refreshHreflang()} files updated`);
  console.log(`sitemap: ${updateSitemap()} translated articles listed`);
}

main();
