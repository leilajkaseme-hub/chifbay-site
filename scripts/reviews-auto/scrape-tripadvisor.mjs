#!/usr/bin/env node
// scrape-tripadvisor.mjs — pulls Chifbay's Tripadvisor reviews via the OFFICIAL
// Tripadvisor Content API and writes data/tripadvisor-reviews.json in the same
// shape as the GetYourGuide and Google scrapers.
//
// Why the API and not a scraper: Tripadvisor sits behind DataDome. Verified
// 2026-07-26 — www.tripadvisor.com, .co.uk and .ca all return HTTP 403 with an
// empty body, headless AND headed, with a persistent profile and a real UA,
// from this Mac's home IP. Scraping it is not a solvable problem from here.
// The Content API is the supported path and has a free tier (5,000 calls/month,
// returns the 5 most recent reviews per location — ample here).
//
// ACTIVATION — this is the only manual step in the whole pipeline:
//   1. Sign up free at https://www.tripadvisor.com/developers
//   2. Create a Content API key. In the key's settings you MUST allowlist the
//      IP this Mac sends from (the key is IP-restricted or it 403s), or add
//      the referer if you choose referer-based restriction.
//   3. Save the key to:  data/.tripadvisor-key      (single line, gitignored)
//      or export TRIPADVISOR_API_KEY in the environment.
// No code change is needed. The moment that file exists the scheduled job
// starts importing Tripadvisor reviews automatically alongside the others.
//
// Until then this script exits 0 without touching anything, so the pipeline
// keeps running on GetYourGuide + Google rather than failing closed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const OUT = join(DATA, "tripadvisor-reviews.json");
const KEYFILE = join(DATA, ".tripadvisor-key");

// From https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html
const LOCATION_ID = "34387047";

function getKey() {
  if (process.env.TRIPADVISOR_API_KEY) return process.env.TRIPADVISOR_API_KEY.trim();
  if (existsSync(KEYFILE)) {
    const k = readFileSync(KEYFILE, "utf8").trim();
    if (k) return k;
  }
  return null;
}

// Tripadvisor returns e.g. "2026-07-14" already; be defensive anyway.
function normalizeDate(d) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function stableId(r) {
  return "tripadvisor-" + String(r.id ?? r.url ?? Math.random());
}

async function main() {
  const key = getKey();
  if (!key) {
    console.log(
      "[tripadvisor] no API key found — skipping (expected until data/.tripadvisor-key exists). " +
      "See the header of scrape-tripadvisor.mjs for the one-time activation steps."
    );
    // Ensure the file exists so build-reviews.mjs can always read it.
    if (!existsSync(OUT)) writeFileSync(OUT, "[]");
    process.exit(0);
  }

  const url =
    `https://api.content.tripadvisor.com/api/v1/location/${LOCATION_ID}/reviews` +
    `?key=${encodeURIComponent(key)}&language=en`;

  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (e) {
    console.error("[tripadvisor] network error:", e.message);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[tripadvisor] API returned HTTP ${res.status}. ` +
      (res.status === 403
        ? "403 usually means the key's IP allowlist does not include this Mac's current public IP — " +
          "update it at tripadvisor.com/developers. "
        : "") +
      body.slice(0, 200)
    );
    process.exit(1);
  }

  const json = await res.json();
  const raw = Array.isArray(json.data) ? json.data : [];

  const reviews = raw
    .filter((r) => r && (r.text || r.title))
    .map((r) => ({
      id: stableId(r),
      source: "tripadvisor",
      rating: Number(r.rating) || 5,
      author: (r.user && (r.user.username || r.user.name)) || "Tripadvisor guest",
      country:
        (r.user && r.user.user_location && r.user.user_location.name) || "",
      countryFlag: "",
      date: normalizeDate(r.published_date || r.travel_date),
      text: (r.text || r.title || "").trim(),
      url: r.url || "",
    }));

  writeFileSync(OUT, JSON.stringify(reviews, null, 2));
  console.log(`[tripadvisor] wrote ${reviews.length} review(s) to ${OUT}`);
}

main().catch((e) => {
  console.error("[tripadvisor] fatal:", e);
  process.exit(1);
});
