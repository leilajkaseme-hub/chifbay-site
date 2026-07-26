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

const URL =
  "https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html";

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

  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Success is "review cards exist", not the HTTP status — see header.
    try {
      await page.waitForSelector(
        '[data-automation="reviewCard"], div[data-test-target="HR_CC_CARD"]',
        { timeout: 30000 }
      );
    } catch {
      console.error(
        "[tripadvisor] no review cards rendered — DataDome challenge was not cleared this run. " +
        "Leaving the previous data file untouched."
      );
      await ctx.close();
      process.exit(1);
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

    const reviews = [];
    for (const c of raw) {
      const lines = c.text.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      const author = lines[0] || "Tripadvisor guest";
      // The line holding "N contribution(s)" separates identity from content;
      // a location line may sit between the author and it.
      const contribIdx = lines.findIndex((l) => /contribution/i.test(l));
      const country = contribIdx > 1 ? lines[1] : "";
      const dateIdx = lines.findIndex((l) => /^[A-Za-z]{3,9}\s+\d{4}$/.test(l));
      if (dateIdx === -1) continue;
      const date = parseDate(lines[dateIdx]);
      const title = dateIdx > 0 ? lines[dateIdx - 1] : "";
      const stop = ["Read more", "Automatically translated", "Written", "Helpful", "Share"];
      let end = lines.length;
      for (let i = dateIdx + 1; i < lines.length; i++) {
        if (stop.some((s) => lines[i].startsWith(s))) { end = i; break; }
      }
      const body = lines.slice(dateIdx + 1, end).join(" ").trim();
      const text = (title && !body.startsWith(title) ? `${title}. ${body}` : body).trim();
      if (!text) continue;
      reviews.push({
        id: stableId(author, date, text),
        source: "tripadvisor",
        rating: c.rating || 5,
        author,
        country,
        countryFlag: "",
        date,
        text,
      });
    }

    if (!reviews.length) {
      console.error("[tripadvisor] cards rendered but nothing parsed — leaving previous data untouched");
      await ctx.close();
      process.exit(1);
    }

    writeFileSync(OUT, JSON.stringify(reviews, null, 2));
    console.log(`[tripadvisor] wrote ${reviews.length} review(s) to ${OUT}`);
    await ctx.close();
  } catch (e) {
    console.error("[tripadvisor] fatal:", e.message.slice(0, 200));
    try { await ctx.close(); } catch {}
    process.exit(1);
  }
}

main();
