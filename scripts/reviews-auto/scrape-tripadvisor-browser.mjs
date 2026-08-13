#!/usr/bin/env node
// scrape-tripadvisor-browser.mjs — pulls Chifbay's Tripadvisor reviews using
// REAL Google Chrome in HEADED mode with a dedicated persistent profile.
//
// Why this specific combination, because every other one fails:
//   bundled Chromium, headless  -> HTTP 403, empty body
//   bundled Chromium, headed    -> HTTP 403, empty body
//   real Chrome,      headless  -> challenge page, 0 review cards
//   real Chrome,      HEADED    -> renders fully, review cards present  <-- this
// Tripadvisor is behind DataDome, which fingerprints the browser build and the
// headless flag. Real Chrome with a visible window passes the challenge; nothing
// else tried does. Verified 2026-07-26.
//
// The 403 you may see logged is the initial DataDome challenge response for the
// navigation — Chrome then solves it and the real document renders. So we judge
// success on whether review cards actually appear, never on the HTTP status.
//
// This runs headed, so a Chrome window appears briefly during the sync. It is
// positioned off the main viewport to stay out of the way. launchd Agents run
// inside the logged-in GUI session, which is why a headed browser works here at
// all; it would not work from a LaunchDaemon or over SSH.
//
// The profile lives in data/.ta-chrome-profile (gitignored) and is deliberately
// persistent — it accumulates its own DataDome clearance cookies over time,
// which makes subsequent runs pass more readily. It is a throwaway profile
// created by this script and is NOT the user's personal Chrome profile.
import { chromium } from "playwright";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const OUT = join(DATA, "tripadvisor-reviews.json");
const PROFILE = join(DATA, ".ta-chrome-profile");

// Chifbay has no single Tripadvisor listing — reviews are split across the
// claimed attraction page plus one auto-generated "product" review page per
// Viator-synced tour. All four get scraped and merged into one file.
const URLS = [
  "https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html",
  "https://www.tripadvisor.ca/AttractionProductReview-g189166-d34572950-Private_Yacht_Cruise_in_Madeira_with_Drinks-Madeira_Madeira_Islands.html",
  "https://www.tripadvisor.ca/AttractionProductReview-g189166-d34509327-Swim_at_Private_Madeira_Coast_Cruise_with_Snacks_and_Drinks-Madeira_Madeira_Island.html",
  "https://www.tripadvisor.ca/AttractionProductReview-g189166-d34500105-Romantic_Private_Sunset_Yacht_Tour_in_Madeira-Madeira_Madeira_Islands.html",
];

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// "Jun 2026" -> "2026-06-15" (mid-month; Tripadvisor only exposes month+year
// on the card, and a stable value matters more than a precise one for sorting)
function parseDate(s) {
  const m = (s || "").match(/([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return "";
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  if (mi < 0) return "";
  return `${m[2]}-${String(mi + 1).padStart(2, "0")}-15`;
}

function stableId(author, dateIso, text) {
  const h = createHash("sha1")
    .update(`${author}|${dateIso}|${(text || "").slice(0, 60)}`)
    .digest("hex");
  return `tripadvisor-${h.slice(0, 12)}`;
}

const CATEGORY_LABELS = [
  "Value for money", "Guide", "Meeting or pickup", "Service", "Location",
  "Rooms", "Cleanliness", "Sleep Quality", "Atmosphere", "Food",
];
const STOP_WORDS = [
  "Read more", "Automatically translated", "Written", "Helpful", "Share",
  "Date visited:", "Machine Translated", "Show original", "Response from",
  ...CATEGORY_LABELS,
];

// The two Tripadvisor templates lay out a review card completely differently:
//  - Attraction_Review pages: line 0 is the bare author name, and a lone
//    "Mon YYYY" line later marks the date, with the line just before it as
//    the review title.
//  - AttractionProductReview pages (one per Viator-synced tour): line 0 is
//    "{Author} wrote a review {Mon} [Day|YYYY]" — no year some of the time —
//    and the real date only appears as a standalone "Mon YYYY" line right
//    after a literal "Date visited:" line, with per-category star labels
//    (e.g. "Value for money", "Guide") injected into the card text before it.
// Product-page format is detected first since it's the more specific shape;
// anything else falls back to the original attraction-page parsing.
function parseCard(lines) {
  const wroteMatch = lines[0].match(/^(.+?)\s+wrote a review\b/);
  const dvIdx = lines.findIndex((l) => l === "Date visited:");

  if (wroteMatch && dvIdx !== -1) {
    const author = wroteMatch[1].trim() || "Tripadvisor guest";
    const dateLine = lines[dvIdx + 1] || "";
    if (!/^[A-Za-z]{3,9}\s+\d{4}$/.test(dateLine)) return null;
    const date = parseDate(dateLine);
    // Line 1 is "{location}{N} contributions" (location may be empty) —
    // skip it as identity metadata rather than treating it as review text.
    // Skip on the looser "contribution" test even when the stricter
    // location-extraction regex fails to parse cleanly — losing the country
    // is a cosmetic loss, but leaving "Bern, Switzerland18 contributions"
    // stuck onto the front of the review body is a real data-quality bug.
    const contribLine = lines[1] || "";
    const isContribLine = /contribution/i.test(contribLine);
    const contribMatch = contribLine.match(/^(.*?)(\d+)\s*contributions?$/i);
    const country = contribMatch ? contribMatch[1].trim() : "";
    const bodyStart = isContribLine ? 2 : 1;
    let end = dvIdx;
    for (let i = bodyStart; i < dvIdx; i++) {
      if (STOP_WORDS.some((s) => lines[i].startsWith(s))) { end = i; break; }
    }
    const text = lines.slice(bodyStart, end).join(" ").replace(/\s*Read less\s*$/i, "").trim();
    return { author, country, date, text };
  }

  // Original attraction-page format.
  const author = lines[0] || "Tripadvisor guest";
  const contribIdx = lines.findIndex((l) => /contribution/i.test(l));
  const country = contribIdx > 1 ? lines[1] : "";
  const dateIdx = lines.findIndex((l) => /^[A-Za-z]{3,9}\s+\d{4}$/.test(l));
  if (dateIdx === -1) return null;
  const date = parseDate(lines[dateIdx]);
  const title = dateIdx > 0 ? lines[dateIdx - 1] : "";
  let end = lines.length;
  for (let i = dateIdx + 1; i < lines.length; i++) {
    if (STOP_WORDS.some((s) => lines[i].startsWith(s))) { end = i; break; }
  }
  const body = lines.slice(dateIdx + 1, end).join(" ").trim();
  const text = (title && !body.startsWith(title) ? `${title}. ${body}` : body).trim();
  return { author, country, date, text };
}

async function main() {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE, {
      channel: "chrome",
      headless: false,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--window-position=2400,1200", // shove it out of the way
      ],
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      timezoneId: "Europe/Lisbon",
    });
  } catch (e) {
    console.error(
      "[tripadvisor] could not launch real Chrome (is Google Chrome installed?):",
      e.message.slice(0, 160)
    );
    process.exit(1);
  }

  const allReviews = [];
  const seenIds = new Set();
  let anyPageSucceeded = false;

  try {
    const page = ctx.pages()[0] || (await ctx.newPage());

    for (const url of URLS) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Success is "review cards exist", not the HTTP status — see header.
        try {
          await page.waitForSelector(
            '[data-automation="reviewCard"], div[data-test-target="HR_CC_CARD"]',
            { timeout: 30000 }
          );
        } catch {
          console.error(
            `[tripadvisor] ${url} — no review cards rendered (DataDome not cleared this run), skipping this page`
          );
          continue;
        }

        // Expand truncated review bodies.
        await page.evaluate(() => {
          [...document.querySelectorAll("button, span")]
            .filter((b) => /^read more$/i.test((b.innerText || "").trim()))
            .forEach((b) => b.click());
        });
        await page.waitForTimeout(1200);

        const raw = await page.evaluate(() => {
          const cards = [
            ...document.querySelectorAll(
              '[data-automation="reviewCard"], div[data-test-target="HR_CC_CARD"]'
            ),
          ];
          return cards.map((c) => {
            const bubble = c.querySelector('[aria-label*="bubble"], svg[aria-label*="bubble"]');
            const aria = bubble ? bubble.getAttribute("aria-label") || "" : "";
            const rm = aria.match(/([\d.]+)\s*of\s*5/);
            return {
              rating: rm ? Math.round(parseFloat(rm[1])) : 5,
              text: c.innerText || "",
            };
          });
        });

        let pageCount = 0;
        for (const c of raw) {
          const lines = c.text.split("\n").map((s) => s.trim()).filter(Boolean);
          if (!lines.length) continue;
          const parsed = parseCard(lines);
          if (!parsed) continue;
          const { author, country, date, text } = parsed;
          if (!text) continue;
          const id = stableId(author, date, text);
          // Tripadvisor syndicates the same review onto more than one of the
          // 4 pages (e.g. the attraction page and its own product page), and
          // the two templates format the title/body join slightly
          // differently (one inserts a period, one doesn't) — enough that a
          // full-text hash fails to catch the duplicate. One person doesn't
          // post two genuine reviews in the same calendar month, so dedupe
          // on author+date instead; `id` itself still hashes the real text.
          const dupeKey = `${author}|${date}`;
          if (seenIds.has(dupeKey)) continue;
          seenIds.add(dupeKey);
          allReviews.push({
            id,
            source: "tripadvisor",
            rating: c.rating || 5,
            author,
            country,
            countryFlag: "",
            date,
            text,
          });
          pageCount++;
        }

        console.log(`[tripadvisor] ${url} — parsed ${pageCount} review(s)`);
        anyPageSucceeded = true;
      } catch (e) {
        console.error(`[tripadvisor] ${url} — failed: ${e.message.slice(0, 160)}`);
      }
    }

    if (!anyPageSucceeded || !allReviews.length) {
      console.error("[tripadvisor] no reviews parsed from any of the 4 pages — leaving previous data untouched");
      await ctx.close();
      process.exit(1);
    }

    writeFileSync(OUT, JSON.stringify(allReviews, null, 2));
    console.log(`[tripadvisor] wrote ${allReviews.length} review(s) total from ${URLS.length} pages to ${OUT}`);
    await ctx.close();
  } catch (e) {
    console.error("[tripadvisor] fatal:", e.message.slice(0, 200));
    try { await ctx.close(); } catch {}
    process.exit(1);
  }
}

main();
