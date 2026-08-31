#!/usr/bin/env node
// scrape-google.mjs — pulls Chifbay's Google reviews straight off Google
// Maps via headless Chromium (no paid Places API / no billing account
// needed). Google shows a cookie-consent interstitial on a fresh session;
// clicking "Accept all" gets past it. Review dates are only ever shown as
// relative text ("a week ago"), so `date` here is an approximation used for
// sorting/display only — the review `id` is Google's own stable
// data-review-id token, NOT derived from that date, so a review never
// flip-flops between "new" and "old" as its relative-time bucket drifts.
//
// Fragility note: unlike GetYourGuide's semantic data-test-id attributes,
// Google Maps' DOM leans on obfuscated, versioned CSS class names that can
// change with any frontend deploy. This script avoids depending on those
// class names anywhere it can (data-review-id, data-photo-index and
// aria-label are stable, documented-ish attributes) but if Google ships a
// structural change, this may need a rewrite — that's a real maintenance
// cost the GYG scraper doesn't have.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(HERE, "..", "..");
const OUT_JSON = join(HERE, "data", "google-reviews.json");
const PHOTOS_DIR = join(SITE_ROOT, "assets", "reviews", "google");
const PLACE_ID = "ChIJLUOnXLFhYAwRzK7dtdeu8Js"; // same place_id used on review.html's Google write-review link
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

mkdirSync(PHOTOS_DIR, { recursive: true });

function relativeToIsoDate(rel, now) {
  const m = rel.match(/^(a|an|\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i);
  if (!m) return now.toISOString().slice(0, 10);
  const n = /^(a|an)$/i.test(m[1]) ? 1 : parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const msPer = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000, year: 31536000000 };
  return new Date(now.getTime() - n * msPer[unit]).toISOString().slice(0, 10);
}

/* Google paints the review list from a CSS background-image sized for that
 * list — w300-h225. Downloading it verbatim gave 300x225 files, which are fine
 * as the 96px thumbnails on the page and useless the moment someone opens one
 * full screen. The same asset serves a larger rendition if you ask for one. */
function bigger(url) {
  return url
    .replace(/\/w\d+-h\d+[^/]*(?=\/|$)/, "/w1600-h1600-k-no")
    .replace(/=w\d+-h\d+[^&]*/, "=w1600-h1600-k-no");
}

/* No existsSync short-circuit any more. It is a few dozen small files, and
 * re-fetching every run is what lets photos already saved at 300px heal
 * themselves instead of staying thumbnails forever. The file is only ever
 * overwritten by a response that actually arrived, so a refusal leaves the
 * copy already on disk untouched. */
async function downloadPhoto(url, destPath) {
  for (const candidate of [bigger(url), url]) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) continue;
      writeFileSync(destPath, buf);
      return true;
    } catch { /* try the next candidate */ }
  }
  return existsSync(destPath);
}

async function main() {
  const now = new Date();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "en-US", userAgent: UA });
  const page = await ctx.newPage();

  try {
    await page.goto(`https://www.google.com/maps/place/?q=place_id:${PLACE_ID}&hl=en`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /accept all/i.test(x.innerText || ""));
      if (b) b.click();
    });
    await page.waitForTimeout(2500);

    const openedReviews = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /^reviews$/i.test((x.innerText || "").trim()));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!openedReviews) {
      // Dump enough context to diagnose remotely — this step has already
      // failed once in GitHub's CI with zero detail (worked fine locally),
      // most likely a consent page in a different language, or Google
      // showing a bot-check to the runner's datacenter IP instead of the
      // plain cookie interstitial seen from a residential IP.
      const debug = await page.evaluate(() => ({
        title: document.title,
        url: location.href,
        bodySnippet: document.body.innerText.slice(0, 600),
        buttonTexts: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter(Boolean).slice(0, 20),
      }));
      console.error("[google] could not find the Reviews tab. Debug info:", JSON.stringify(debug, null, 2));
      process.exit(1);
    }
    await page.waitForTimeout(2500);

    // Wait for the first review card to actually render before scrolling.
    // Without this the loop below hit a race: if no [data-review-id] existed
    // yet it broke on iteration 1 and we scraped only the handful already
    // painted. That is how a run returned 3 reviews when the previous run
    // returned 7, with no error.
    try {
      await page.waitForSelector("[data-review-id]", { timeout: 20000 });
    } catch {
      console.error("[google] no review cards rendered after opening the Reviews tab");
      process.exit(1);
    }

    // Best-effort: sort by newest so freshly posted reviews are guaranteed to
    // be in the first batch. Google defaults to "Most relevant", which can bury
    // a brand-new review below the fold — the exact thing this job exists to
    // catch. Non-fatal: if the control moves or is renamed we carry on with
    // the default ordering rather than failing the whole sync.
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")]
          .find((x) => /^(sort|most relevant)$/i.test((x.innerText || "").trim()));
        if (b) b.click();
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const opt = [...document.querySelectorAll('[role="menuitemradio"], [role="menuitem"], button')]
          .find((x) => /^newest$/i.test((x.innerText || "").trim()));
        if (opt) opt.click();
      });
      await page.waitForTimeout(2000);
    } catch { /* keep default ordering */ }

    // The reviews pane is VIRTUALIZED: Google drops cards out of the DOM once
    // they scroll off screen. The original code scrolled to the bottom and then
    // read [data-review-id] once, so it only ever saw whatever happened to be
    // rendered at that moment — which is why a run could return a
    // non-contiguous subset (newest, then #5 and #6, skipping #2-#4) with no
    // error. Observed live: 7 reviews from an interactive shell, 3 under
    // launchd, from identical code.
    //
    // So harvest incrementally instead: after every scroll step, expand any
    // truncated text and copy whatever is currently rendered into a page-level
    // Map keyed by review id. Cards that later get virtualized away are already
    // banked. The Map is read once at the end.
    await page.evaluate(() => {
      window.__harvest = () => {
        window.__collected = window.__collected || new Map();
        document.querySelectorAll("[data-review-id]").forEach((el) => {
          const id = el.getAttribute("data-review-id");
          if (!id) return;
          const ratingEl = el.querySelector('[aria-label*="star"]');
          const ratingM = ratingEl ? ratingEl.getAttribute("aria-label").match(/(\d+)\s*star/) : null;
          const rating = ratingM ? parseInt(ratingM[1], 10) : 5;
          const photos = [...el.querySelectorAll("[data-photo-index]")]
            .map((p) => (p.getAttribute("style") || "").match(/url\("([^"]+)"\)/))
            .filter(Boolean)
            .map((m) => m[1]);
          const rec = { id, rating, photos, text: el.innerText };
          // Prefer the longest text seen for an id — a later pass may catch it
          // after its "More" button was expanded.
          const old = window.__collected.get(id);
          if (!old || (rec.text || "").length > (old.text || "").length) {
            window.__collected.set(id, rec);
          }
        });
        return window.__collected.size;
      };
    });

    let stagnant = 0;
    for (let i = 0; i < 25 && stagnant < 4; i++) {
      // Expand truncated reviews in the current window, then bank them.
      await page.evaluate(() => {
        [...document.querySelectorAll("button")]
          .filter((b) => /^more$/i.test((b.innerText || "").trim()))
          .forEach((b) => b.click());
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__harvest());

      const delta = await page.evaluate(async () => {
        const card = document.querySelector("[data-review-id]");
        if (!card) return -1;
        let n = card.parentElement;
        while (n && !(getComputedStyle(n).overflowY === "auto" && n.scrollHeight > n.clientHeight)) n = n.parentElement;
        if (!n) return -1;
        const before = n.scrollHeight;
        n.scrollTop = n.scrollHeight;
        await new Promise((r) => setTimeout(r, 600));
        return n.scrollHeight - before;
      });
      if (delta < 0) break;
      stagnant = delta === 0 ? stagnant + 1 : 0;
      await page.waitForTimeout(600);
    }

    // Final sweep for anything rendered by the last scroll.
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .filter((b) => /^more$/i.test((b.innerText || "").trim()))
        .forEach((b) => b.click());
    });
    await page.waitForTimeout(600);
    const cards = await page.evaluate(() => {
      window.__harvest();
      return [...window.__collected.values()];
    });

    const reviews = [];
    for (const c of cards) {
      const lines = c.text.split("\n").map((s) => s.trim());
      const timeIdx = lines.findIndex((l) => /^(a|an|\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.test(l));
      if (timeIdx === -1) continue;
      const author = lines[0] || "Google user";
      const relTime = lines[timeIdx];
      let start = timeIdx + 1;
      if (lines[start] === "NEW") start++;
      const stopMarkers = ["Visited on", "Translated by Google", "Like"];
      let end = lines.length;
      for (let i = start; i < lines.length; i++) {
        if (stopMarkers.some((m) => lines[i].startsWith(m))) { end = i; break; }
      }
      const text = lines.slice(start, end).filter(Boolean).join(" ").trim();
      if (!text) continue; // rating-only Google reviews aren't distinguishable from parsing noise here — skip rather than risk garbage

      const photoPaths = [];
      for (let i = 0; i < c.photos.length; i++) {
        const filename = `google-${id_slug(c.id)}-${i + 1}.jpg`;
        const dest = join(PHOTOS_DIR, filename);
        const ok = await downloadPhoto(c.photos[i], dest).catch(() => false);
        if (ok) photoPaths.push(`assets/reviews/google/${filename}`);
      }

      reviews.push({
        id: `google-${id_slug(c.id)}`,
        source: "google",
        rating: c.rating,
        author,
        country: "",
        countryFlag: "",
        date: relativeToIsoDate(relTime, now),
        text,
        photos: photoPaths,
        tourId: null,
        tourName: null,
        tourUrl: `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
        reply: null,
      });
    }

    writeFileSync(OUT_JSON, JSON.stringify(reviews, null, 2));
    console.log(`[google] wrote ${reviews.length} review(s) to ${OUT_JSON}`);
  } catch (e) {
    console.error(`[google] FAILED: ${e.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function id_slug(dataReviewId) {
  // data-review-id tokens for the same place share a long common prefix
  // (confirmed empirically — truncating the raw string collided 3 distinct
  // reviews onto one id), so hash the FULL token instead of slicing it.
  return createHash("sha1").update(dataReviewId).digest("hex").slice(0, 16);
}

main();
