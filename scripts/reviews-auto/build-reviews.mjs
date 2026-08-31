#!/usr/bin/env node
// build-reviews.mjs — merges GetYourGuide (auto), Google (auto), and
// Tripadvisor (manually maintained — see data/tripadvisor-manual.json,
// updated by hand since TA blocks every scraper, headless or not) into one
// review set, translates any non-English text via Claude (cached per id so
// repeat runs don't re-spend tokens), regenerates the reviews.html cards +
// badge, and writes site/reviews.json for the homepage teaser to fetch.
//
// Prints NEW_REVIEW_IDS=<n> and a human summary to stdout so the GitHub
// Action can decide whether to ntfy the user about brand-new reviews.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(HERE, "..", "..");
const REVIEWS_HTML = join(SITE_ROOT, "reviews.html");
const INDEX_HTML = join(SITE_ROOT, "index.html");
const PUBLIC_JSON = join(SITE_ROOT, "reviews.json");

function readJsonIfExists(path, fallback = []) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return fallback; }
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function stars(n) {
  return "★".repeat(Math.max(0, Math.min(5, Math.round(n)))) + "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(n))));
}

const SOURCE_LABEL = {
  getyourguide: "Verified booking · GetYourGuide",
  google: "Google review",
  tripadvisor: "Tripadvisor review",
};

async function translateIfNeeded(review, prevById) {
  const prev = prevById.get(review.id);
  if (prev && typeof prev.translation !== "undefined") {
    review.translation = prev.translation;
    return;
  }
  if (!review.text || review.text.length < 3) { review.translation = null; return; }
  if (!process.env.ANTHROPIC_API_KEY) { review.translation = null; return; }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `A guest review for a boat tour company. If it is already in English, reply with exactly the word NONE (nothing else). Otherwise reply with ONLY a natural English translation, no preamble, no quotes.\n\nReview:\n${review.text}`,
      }],
    });
    const out = msg.content?.[0]?.text?.trim() || "";
    review.translation = (out === "" || out === "NONE") ? null : out;
  } catch (e) {
    console.error(`[build] translation failed for ${review.id}: ${e.message}`);
    review.translation = null;
  }
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Formats a date-only "YYYY-MM-DD" string for display WITHOUT going through
// Date()'s local-timezone parsing, which silently shifts date-only values
// (no time component) back a day on any positive-UTC system.
function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

function renderCard(r) {
  const compact = !r.text;
  const flagCountry = [r.countryFlag, r.country].filter(Boolean).join(" ");
  const dateStr = formatDate(r.date);

  if (compact) {
    return `      <article class="rq compact rv">
        <div class="rq-stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
        <div class="rq-meta" style="margin:0">
          <span class="who">${escapeHtml(r.author)}</span>${flagCountry ? " · " + escapeHtml(flagCountry) : ""} · ${dateStr}
          <span class="src">${SOURCE_LABEL[r.source] || r.source}</span>
          <span style="opacity:.6">${r.rating}-star rating</span>
        </div>
      </article>`;
  }

  const gloss = r.translation
    ? `\n        <div class="rq-gloss"><span class="gt">English translation</span>${escapeHtml(r.translation)}</div>`
    : "";
  const photos = (r.photos && r.photos.length)
    ? `\n        <div class="rq-photos">${r.photos.map((p) => `<img src="${p}" loading="lazy" alt="Photo from ${escapeHtml(r.author)}'s review">`).join("")}</div>`
    : "";
  const reply = r.reply
    ? `\n        <div class="rq-reply"><span class="rt">Response from Chifbay</span>${escapeHtml(r.reply.text)}</div>`
    : "";
  const tourLink = r.tourUrl && r.tourName
    ? `\n          <a href="${r.tourUrl}" target="_blank" rel="noopener">${escapeHtml(r.tourName)}</a>`
    : "";

  // La classe src-* porte l'identité visuelle de la plateforme d'origine
  // (liseré orange GetYourGuide, quadricolore Google, vert Tripadvisor).
  // Voir le bloc "avis — identité de la source" dans atlas.css.
  return `      <article class="rq rv src-${escapeHtml(r.source)}">
        <div class="rq-stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
        <p class="rq-text">“${escapeHtml(r.text)}”</p>${gloss}${photos}
        <div class="rq-meta">
          <span class="who">${escapeHtml(r.author)}</span>${flagCountry ? " · " + escapeHtml(flagCountry) : ""} · ${dateStr}
          <span class="src">${SOURCE_LABEL[r.source] || r.source}</span>${tourLink}
        </div>${reply}
      </article>`;
}

function replaceBetween(html, startMarker, endMarker, inner) {
  const re = new RegExp(`(${startMarker})[\\s\\S]*?(${endMarker})`);
  if (!re.test(html)) throw new Error(`markers not found: ${startMarker} / ${endMarker}`);
  return html.replace(re, `$1\n${inner}\n    $2`);
}

async function main() {
  const gyg = readJsonIfExists(join(HERE, "data", "gyg-reviews.json"));
  const google = readJsonIfExists(join(HERE, "data", "google-reviews.json"));
  // Tripadvisor arrives from two places: the Content API (automatic, populated
  // by scrape-tripadvisor.mjs once data/.tripadvisor-key exists) and the
  // hand-maintained file. Merge both, with API entries winning on id collision
  // so a manually added review is superseded once the API returns the real one.
  const taApi = readJsonIfExists(join(HERE, "data", "tripadvisor-reviews.json"));
  const taManual = readJsonIfExists(join(HERE, "data", "tripadvisor-manual.json"));
  const apiIds = new Set(taApi.map((r) => r.id));
  const ta = [
    ...taApi,
    ...taManual.filter((r) => !apiIds.has(r.id)).map((r) => ({ ...r, manual: true })),
  ];

  const prev = readJsonIfExists(PUBLIC_JSON, { reviews: [] });
  const prevById = new Map((prev.reviews || []).map((r) => [r.id, r]));

  // UNION with what we already published — never a straight replace.
  //
  // These scrapers are inherently flaky: Google Maps lazy-loads its review
  // list, so a run that scrolls a little less returns fewer reviews WITHOUT
  // erroring. Observed live on 2026-07-26 — one run returned 7 Google reviews
  // and the next returned 3, and because this line used to be a plain replace
  // it deleted four genuine reviews from the site and pushed the result.
  //
  // A freshly scraped copy wins for a given id (so edited text or a changed
  // rating propagates), but any review we have seen before and did not
  // re-scrape this run is carried forward rather than dropped. Reviews being
  // removed upstream is rare; losing them to a partial scrape was routine.
  const scraped = [...gyg, ...google, ...ta];
  const scrapedById = new Map(scraped.map((r) => [r.id, r]));
  const carried = (prev.reviews || []).filter((r) => !scrapedById.has(r.id));
  // Tripadvisor's Content API sometimes prepends its own UI label ("See all
  // N photos") to the review text — a scraping artifact, not part of what
  // the guest wrote. Strip it so it never reaches the page or JSON-LD.
  const all = [...scraped, ...carried].map((r) => (
    r.text ? { ...r, text: r.text.replace(/^See all \d+ photos?\s*/i, "") } : r
  ));

  if (carried.length) {
    console.log(
      `[build] carried forward ${carried.length} previously published review(s) ` +
      `not returned by this run's scrape`
    );
  }

  if (!all.length) {
    console.error("[build] no reviews from any source — aborting without touching reviews.html");
    process.exit(1);
  }

  // Last line of defense before anything goes live: a real incident showed
  // an upstream scraper can silently return a near-empty result without
  // erroring (bot-block, not a thrown exception). Individual scrapers now
  // guard against that themselves, but this catches it here too in case a
  // bad data file ever reaches this step some other way.
  const prevCount = (prev.reviews || []).length;
  if (prevCount >= 4 && all.length < prevCount * 0.5) {
    console.error(`[build] SUSPICIOUS DROP: ${prevCount} -> ${all.length} merged reviews (more than half missing) — aborting without touching reviews.html`);
    process.exit(1);
  }

  for (const r of all) await translateIfNeeded(r, prevById);

  all.sort((a, b) => (a.date < b.date ? 1 : -1));

  const newOnes = all.filter((r) => !prevById.has(r.id));
  const ratingSum = all.reduce((s, r) => s + (r.rating || 0), 0);
  const aggregate = { rating: all.length ? Math.round((ratingSum / all.length) * 10) / 10 : 0, count: all.length };

  // Reuse the previous updatedAt when the review content is byte-identical —
  // otherwise this timestamp alone would make reviews.json diff on every
  // run even when nothing changed, forcing a meaningless commit every run
  // forever from the local sync job.
  const contentUnchanged = JSON.stringify(all) === JSON.stringify(prev.reviews || []);
  const updatedAt = contentUnchanged && prev.updatedAt ? prev.updatedAt : new Date().toISOString();

  writeFileSync(PUBLIC_JSON, JSON.stringify({ updatedAt, aggregate, reviews: all }, null, 2));

  const cardsHtml = all.map(renderCard).join("\n\n");
  const sourceNames = { getyourguide: "GetYourGuide", google: "Google", tripadvisor: "Tripadvisor" };
  const presentSources = [...new Set(all.map((r) => sourceNames[r.source] || r.source))];
  const sourcesLabel = presentSources.length > 1
    ? presentSources.slice(0, -1).join(", ") + " & " + presentSources.slice(-1)
    : presentSources[0] || "";
  // Liens vers les pages d'avis PUBLIQUES de chaque plateforme, pour que le
  // visiteur puisse vérifier lui-même plutôt que de nous croire sur parole.
  // À ne pas confondre avec les URL "écrire un avis" de review.html, qui
  // ouvrent un formulaire au lieu de la fiche.
  const SOURCE_LINKS = {
    google: { label: "Google", url: "https://maps.google.com/?cid=11236673311781793484", note: "Voir la fiche Google" },
    getyourguide: { label: "GetYourGuide", url: "https://www.getyourguide.com/funchal-l1026/luxury-sunset-yacht-experience-madeira-t1314963/", note: "Réservations vérifiées" },
    tripadvisor: { label: "Tripadvisor", url: "https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html", note: "Voir la fiche Tripadvisor" },
  };
  const EN_NOTE = { google: "See our Google listing", getyourguide: "Verified bookings", tripadvisor: "See our Tripadvisor listing" };
  const perSource = all.reduce((a, r) => ((a[r.source] = (a[r.source] || 0) + 1), a), {});

  const badgesHtml = [
    `      <div class="rq-badge rq-badge-agg">
        <span class="n">${aggregate.rating.toFixed(1)}<span style="font-size:.9rem;opacity:.6">/5</span></span>
        <span class="d">${aggregate.count} verified review${aggregate.count === 1 ? "" : "s"} across ${sourcesLabel}</span>
      </div>`,
    ...Object.keys(SOURCE_LINKS)
      .filter((k) => perSource[k])
      .map((k) => {
        const s = SOURCE_LINKS[k];
        return `      <a class="rq-badge rq-src-link src-${k}" href="${s.url}" target="_blank" rel="noopener">
        <span class="n">${perSource[k]}</span>
        <span class="d"><b>${s.label}</b><br>${EN_NOTE[k]} →</span>
      </a>`;
      }),
  ].join("\n");

  let html = readFileSync(REVIEWS_HTML, "utf-8");
  html = replaceBetween(html, "<!-- REVIEWS:BADGES -->", "<!-- /REVIEWS:BADGES -->", badgesHtml);
  html = replaceBetween(html, "<!-- REVIEWS:LIST -->", "<!-- /REVIEWS:LIST -->", cardsHtml);
  writeFileSync(REVIEWS_HTML, html);

  // Keep the homepage's JSON-LD aggregateRating (used for search-result
  // star snippets) from silently drifting away from the real count — it
  // was hardcoded at "6" and would otherwise never update again.
  /* Every page that states the count — found, not remembered.
   *
   * This has gone wrong twice now. On 2026-07-26 the root homepage said 15
   * while /fr/ /de/ /pt/ /es/ /it/ all still said 10, and the fix was to add
   * the localized homepages to a hard-coded list. On 2026-08-31 the same bug
   * surfaced on the two pages nobody had put on that list: reviews.html itself
   * was serving reviewCount 45 against a real 56, and experiences.html read
   * "from 40 verified reviews".
   *
   * reviews.html escaped for a second reason worth keeping in mind: its block
   * carries an extra "bestRating" key, and the old pattern pinned the exact
   * key order, so it matched nothing and said nothing.
   *
   * Every one of these pages declares the SAME business @id. Publishing
   * several different review counts for one entity is the contradiction that
   * gets a rich result dropped.
   *
   * So: walk the repo, rewrite the two fields inside any aggregateRating
   * whatever else it holds, then CHECK the work — a list someone maintains by
   * hand is what failed both times.
   */
  const RATING = aggregate.rating.toFixed(1);
  const COUNT = String(aggregate.count);

  function htmlFiles() {
    return readdirSync(SITE_ROOT, { recursive: true })
      .filter((f) => typeof f === "string" && f.endsWith(".html"))
      .filter((f) => !f.split(/[\\/]/).includes("node_modules"))
      .map((f) => join(SITE_ROOT, f));
  }

  let pagesFixed = 0;
  for (const file of htmlFiles()) {
    const before = readFileSync(file, "utf-8");
    const after = before
      .replace(/"aggregateRating"\s*:\s*\{[^{}]*\}/g, (block) =>
        block
          .replace(/"ratingValue"\s*:\s*"?[\d.]+"?/, `"ratingValue":"${RATING}"`)
          .replace(/"reviewCount"\s*:\s*"?\d+"?/, `"reviewCount":"${COUNT}"`))
      // the visible trust-strip line, e.g. "from 40 verified reviews"
      .replace(/(<span class="ts-rc">[^<]*?)\b\d+\b/g, `$1${COUNT}`);
    if (after !== before) { writeFileSync(file, after); pagesFixed++; }
  }
  if (pagesFixed) console.log(`[build] review count set to ${RATING}/${COUNT} on ${pagesFixed} page(s)`);

  /* Then check the work — and check it DELIBERATELY MORE BROADLY than the
   * fixer above. A check written with the fixer's own pattern can only ever
   * find what the fixer already repaired, so it is guaranteed to stay silent
   * and proves nothing. This one looks for any reviewCount anywhere in the
   * file, so a block the fixer cannot rewrite (nested, reformatted, split
   * across lines) is exactly what it reports. */
  const mismatches = [];
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf-8");
    const where = relative(SITE_ROOT, file);
    for (const m of html.matchAll(/"reviewCount"\s*:\s*"?(\d+)/g)) {
      if (m[1] !== COUNT) mismatches.push(`${where} schema says ${m[1]}`);
    }
    for (const m of html.matchAll(/class="ts-rc"[^>]*>([^<]*)</g)) {
      const c = /\b(\d+)\b/.exec(m[1]);
      if (c && c[1] !== COUNT) mismatches.push(`${where} trust strip says ${c[1]}`);
    }
  }
  if (mismatches.length) {
    console.log(`REVIEW_COUNT_MISMATCH=${mismatches.join("; ")}`);
  }

  console.log(`[build] merged ${all.length} reviews (${gyg.length} GYG, ${google.length} Google, ${ta.length} Tripadvisor) — aggregate ${aggregate.rating}/5`);
  console.log(`NEW_REVIEW_COUNT=${newOnes.length}`);
  if (newOnes.length) {
    console.log("NEW_REVIEW_SUMMARY=" + newOnes.map((r) => `${r.author} (${r.source}, ${r.rating}★)`).join("; "));
  }
}

main();
