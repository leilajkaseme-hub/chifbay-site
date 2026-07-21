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
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(HERE, "..", "..");
const REVIEWS_HTML = join(SITE_ROOT, "reviews.html");
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

  return `      <article class="rq rv">
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
  const ta = readJsonIfExists(join(HERE, "data", "tripadvisor-manual.json"));

  const prev = readJsonIfExists(PUBLIC_JSON, { reviews: [] });
  const prevById = new Map((prev.reviews || []).map((r) => [r.id, r]));

  const all = [...gyg, ...google, ...ta.map((r) => ({ ...r, manual: true }))];
  if (!all.length) {
    console.error("[build] no reviews from any source — aborting without touching reviews.html");
    process.exit(1);
  }

  for (const r of all) await translateIfNeeded(r, prevById);

  all.sort((a, b) => (a.date < b.date ? 1 : -1));

  const newOnes = all.filter((r) => !prevById.has(r.id));
  const ratingSum = all.reduce((s, r) => s + (r.rating || 0), 0);
  const aggregate = { rating: all.length ? Math.round((ratingSum / all.length) * 10) / 10 : 0, count: all.length };

  writeFileSync(PUBLIC_JSON, JSON.stringify({ updatedAt: new Date().toISOString(), aggregate, reviews: all }, null, 2));

  const cardsHtml = all.map(renderCard).join("\n\n");
  const sourceNames = { getyourguide: "GetYourGuide", google: "Google", tripadvisor: "Tripadvisor" };
  const presentSources = [...new Set(all.map((r) => sourceNames[r.source] || r.source))];
  const sourcesLabel = presentSources.length > 1
    ? presentSources.slice(0, -1).join(", ") + " & " + presentSources.slice(-1)
    : presentSources[0] || "";
  const badgesHtml = `      <div class="rq-badge">
        <span class="n">${aggregate.rating.toFixed(1)}<span style="font-size:.9rem;opacity:.6">/5</span></span>
        <span class="d">${aggregate.count} verified review${aggregate.count === 1 ? "" : "s"} across ${sourcesLabel}<br><a href="https://www.getyourguide.com/funchal-l1026/private-dolphin-and-whale-watching-madeira-t1342812/" target="_blank" rel="noopener">GetYourGuide · verified bookings →</a></span>
      </div>
      <div class="rq-badge">
        <span class="n">🦉</span>
        <span class="d">Find us on Tripadvisor<br><a href="https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html" target="_blank" rel="noopener">ChifBay Luxury Yacht Experiences →</a></span>
      </div>`;

  let html = readFileSync(REVIEWS_HTML, "utf-8");
  html = replaceBetween(html, "<!-- REVIEWS:BADGES -->", "<!-- /REVIEWS:BADGES -->", badgesHtml);
  html = replaceBetween(html, "<!-- REVIEWS:LIST -->", "<!-- /REVIEWS:LIST -->", cardsHtml);
  writeFileSync(REVIEWS_HTML, html);

  console.log(`[build] merged ${all.length} reviews (${gyg.length} GYG, ${google.length} Google, ${ta.length} Tripadvisor) — aggregate ${aggregate.rating}/5`);
  console.log(`NEW_REVIEW_COUNT=${newOnes.length}`);
  if (newOnes.length) {
    console.log("NEW_REVIEW_SUMMARY=" + newOnes.map((r) => `${r.author} (${r.source}, ${r.rating}★)`).join("; "));
  }
}

main();
