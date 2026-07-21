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

async function downloadPhoto(url, destPath) {
  if (existsSync(destPath)) return true;
  const res = await fetch(url);
  if (!res.ok) return false;
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
  return true;
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

    // The reviews list is a virtualized, independently-scrollable pane —
    // scroll it (not the window) so any reviews beyond the first batch load.
    for (let i = 0; i < 15; i++) {
      const grew = await page.evaluate(() => {
        const card = document.querySelector("[data-review-id]");
        if (!card) return false;
        let n = card.parentElement;
        while (n && !(getComputedStyle(n).overflowY === "auto" && n.scrollHeight > n.clientHeight)) n = n.parentElement;
        if (!n) return false;
        const before = n.scrollHeight;
        n.scrollTop = n.scrollHeight;
        return before;
      });
      if (!grew) break;
      await page.waitForTimeout(900);
    }

    // Expand every truncated review ("... More") before reading text.
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].filter((b) => /^more$/i.test((b.innerText || "").trim())).forEach((b) => b.click());
    });
    await page.waitForTimeout(500);

    const cards = await page.evaluate(() => {
      const seen = new Set();
      const roots = [];
      document.querySelectorAll("[data-review-id]").forEach((el) => {
        const id = el.getAttribute("data-review-id");
        if (seen.has(id)) return;
        seen.add(id);
        roots.push(el);
      });
      return roots.map((el) => {
        const id = el.getAttribute("data-review-id");
        const ratingEl = el.querySelector('[aria-label*="star"]');
        const ratingM = ratingEl ? ratingEl.getAttribute("aria-label").match(/(\d+)\s*star/) : null;
        const rating = ratingM ? parseInt(ratingM[1], 10) : 5;
        const photos = [...el.querySelectorAll("[data-photo-index]")]
          .map((p) => (p.getAttribute("style") || "").match(/url\("([^"]+)"\)/))
          .filter(Boolean)
          .map((m) => m[1]);
        return { id, rating, photos, text: el.innerText };
      });
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
