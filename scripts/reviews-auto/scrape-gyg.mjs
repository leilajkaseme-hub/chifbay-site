#!/usr/bin/env node
// scrape-gyg.mjs — pulls every review (text, rating, reply, reviewer photos)
// off Chifbay's 4 GetYourGuide tour pages via headless Chromium (plain
// fetch/WebFetch gets bot-blocked on GYG; a headless browser passes) and
// writes data/gyg-reviews.json + downloads any new reviewer photos into
// ../../assets/reviews/gyg/. Safe to re-run: existing photo files are kept,
// review ids are stable hashes so unchanged reviews don't get re-flagged.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { flagFor } from "./lib/countries.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(HERE, "..", "..");
const TOURS = JSON.parse(readFileSync(join(HERE, "data", "gyg-tours.json"), "utf-8"));
const OUT_JSON = join(HERE, "data", "gyg-reviews.json");
const PHOTOS_DIR = join(SITE_ROOT, "assets", "reviews", "gyg");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

mkdirSync(PHOTOS_DIR, { recursive: true });

function reviewId(tourId, author, dateIso, text) {
  const h = createHash("sha1").update(`${tourId}|${author}|${dateIso}|${text.slice(0, 60)}`).digest("hex");
  return `gyg-${h.slice(0, 12)}`;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// Parses "June 20, 2026" OR the abbreviated "Jun 20, 2026" (GYG renders
// either form depending on which layout variant the card uses — confirmed
// by direct DOM inspection, not documented anywhere) into "2026-06-20"
// WITHOUT going through Date(), whose local-timezone parsing silently
// shifts date-only values back a day on any positive-UTC system (a real
// bug caught here: Conny's "June 20" was coming out "June 19").
function parseMonthDayYear(str) {
  const m = str.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const key = m[1].toLowerCase().slice(0, 3);
  const mi = MONTHS.findIndex((full) => full.slice(0, 3) === key);
  if (mi === -1) return null;
  const day = String(m[2]).padStart(2, "0");
  const month = String(mi + 1).padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

async function extractCards(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-test-id="activity-review-card"]')];
    return cards.map((el) => {
      const rating = el.querySelectorAll(".rating-star__icon--full").length;
      const nameLine = el.querySelector(".review-card__author-details-name")?.innerText?.trim() || "";
      const legend = el.querySelector(".review-card__author-details-name-legend")?.innerText?.trim() || "";
      const text = el.querySelector('[data-test-id="toggle-content"]')?.innerText?.trim() || "";
      const replyText = el.querySelector(".review-reply__text")?.innerText?.trim() || "";
      const replyDateRaw = el.querySelector(".review-reply__date")?.innerText?.trim() || "";
      const avatarEl = el.querySelector(".review-card__author-photo");
      const photos = [...el.querySelectorAll("img")]
        .filter((img) => !avatarEl || !avatarEl.contains(img))
        .map((img) => img.src)
        .filter((src) => /cdn\.getyourguide\.com\/img\/review\//.test(src));
      return { rating, nameLine, legend, text, replyText, replyDateRaw, photos };
    });
  });
}

async function loadAllReviews(page) {
  // GYG paginates behind a "See more" button once review counts grow.
  for (let i = 0; i < 20; i++) {
    const btn = page.getByRole("button", { name: "See more", exact: true }).first();
    if (!(await btn.count())) break;
    const before = await page.evaluate(() => document.querySelectorAll('[data-test-id="activity-review-card"]').length);
    await btn.click().catch(() => {});
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => document.querySelectorAll('[data-test-id="activity-review-card"]').length);
    if (after <= before) break;
  }
}

async function downloadPhoto(url, destPath) {
  if (existsSync(destPath)) return true;
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const reviews = [];
  const errors = [];
  let zeroCardTours = 0;

  for (const tour of TOURS) {
    const page = await browser.newPage({ userAgent: UA });
    try {
      await page.goto(tour.url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1500);
      await loadAllReviews(page);
      const cards = await extractCards(page);

      if (cards.length === 0) {
        zeroCardTours++;
        // A known listing that normally has reviews suddenly showing none
        // is far more likely a bot-block/consent-wall than a real change —
        // dump context so a CI failure is actually diagnosable.
        const debug = await page.evaluate(() => ({
          title: document.title,
          bodySnippet: document.body.innerText.slice(0, 400),
        }));
        console.error(`[gyg] ${tour.id}: 0 review cards found — debug: ${JSON.stringify(debug)}`);
      }

      for (const c of cards) {
        if (!c.nameLine) continue;
        const [authorRaw, countryRaw] = c.nameLine.split("–").map((s) => s?.trim());
        const author = authorRaw || "GetYourGuide traveler";
        const country = countryRaw || "";
        const dateIso = parseMonthDayYear(c.legend);
        if (!dateIso) {
          // Don't silently mislabel a review with today's date — that's a
          // worse failure mode than skipping it. Log loudly and move on.
          console.error(`[gyg] ${tour.id}: could not parse date from legend "${c.legend}" for ${author} — skipping this review`);
          continue;
        }
        const id = reviewId(tour.id, author, dateIso, c.text);

        const photoPaths = [];
        for (let i = 0; i < c.photos.length; i++) {
          const ext = ".jpg";
          const filename = `${id}-${i + 1}${ext}`;
          const dest = join(PHOTOS_DIR, filename);
          const ok = await downloadPhoto(c.photos[i], dest).catch(() => false);
          if (ok) photoPaths.push(`assets/reviews/gyg/${filename}`);
        }

        const replyDate = c.replyDateRaw ? parseMonthDayYear(c.replyDateRaw) : null;

        reviews.push({
          id,
          source: "getyourguide",
          rating: c.rating || 5,
          author,
          country,
          countryFlag: flagFor(country),
          date: dateIso,
          text: c.text.replace(/\s*Read more\s*$/, "").trim(),
          photos: photoPaths,
          tourId: tour.id,
          tourName: tour.name,
          tourUrl: tour.url,
          reply: c.replyText ? { text: c.replyText, date: replyDate } : null,
        });
      }
      console.log(`[gyg] ${tour.id} (${tour.name}): ${cards.length} review(s)`);
    } catch (e) {
      errors.push(`${tour.id}: ${e.message}`);
      console.error(`[gyg] ${tour.id} FAILED: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // A real production incident caught this: every tour "succeeded" (no
  // thrown error) but returned 0 review cards — silently overwrote 7 real
  // reviews (with photos) with an empty array, which then got committed
  // and pushed live. Treat "every tour errored OR came back empty" as one
  // failure category — a page loading fine but showing no reviews for
  // listings that are known to have them is a bot-block, not real data.
  if (errors.length + zeroCardTours === TOURS.length) {
    console.error(`[gyg] ALL ${TOURS.length} tours failed or returned 0 reviews — leaving existing gyg-reviews.json untouched.`);
    process.exit(1);
  }

  // Same incident, softer version: a PARTIAL block (say 3 of 4 tours
  // return 0) wouldn't trip the guard above but would still silently
  // publish a big regression. Real reviews essentially never disappear in
  // bulk, so losing more than half of what was there last run is treated
  // as a scraper problem, not real content change.
  const prev = existsSync(OUT_JSON) ? JSON.parse(readFileSync(OUT_JSON, "utf-8")) : [];
  if (prev.length >= 4 && reviews.length < prev.length * 0.5) {
    console.error(`[gyg] SUSPICIOUS DROP: ${prev.length} -> ${reviews.length} reviews (more than half missing) — leaving existing gyg-reviews.json untouched.`);
    process.exit(1);
  }

  reviews.sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(OUT_JSON, JSON.stringify(reviews, null, 2));
  console.log(`[gyg] wrote ${reviews.length} review(s) to ${OUT_JSON}`);
}

main();
