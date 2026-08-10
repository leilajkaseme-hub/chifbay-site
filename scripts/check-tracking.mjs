/**
 * Proves track.js works, in a real browser.
 *
 *   node scripts/check-tracking.mjs
 *
 * Runs with fake ids and blocks Google and Meta, so nothing leaves the machine
 * and no junk lands in your real reports. Starts its own web server.
 *
 * Run this after editing track.js, and after any locale or blog rebuild.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Playwright is not installed at the site root — it belongs to the reviews
// sync. Borrow that copy instead of adding a second one.
const { chromium } = await import("playwright").catch(() =>
  import(path.join(ROOT, "scripts/reviews-auto/node_modules/playwright/index.mjs"))
);

// Fake ids everywhere, including the real Google Ads one — a test run must
// never be able to put junk data into the live account.
const SRC = fs.readFileSync(path.join(ROOT, "track.js"), "utf8")
  .replace(/GA4_ID: "[^"]*"/, 'GA4_ID: "G-TEST12345"')
  .replace(/META_PIXEL_ID: "[^"]*"/, 'META_PIXEL_ID: "111222333"')
  .replace(/GOOGLE_ADS_ID: "[^"]*"/, 'GOOGLE_ADS_ID: "AW-000000000"')
  .replace("DEBUG: false", "DEBUG: true");

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
process.on("exit", () => server.kill());

for (let i = 0; i < 40; i++) {
  try { await fetch(`${BASE}/track.js`); break; } catch { await new Promise(r => setTimeout(r, 150)); }
}
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Serve the patched file, and swallow the real tag requests. Routed on the
// context, not the page, so every tab this test opens is covered.
await ctx.route("**/track.js", r => r.fulfill({ contentType: "application/javascript", body: SRC }));
for (const host of ["**googletagmanager.com**", "**google-analytics.com**", "**googleadservices.com**",
                    "**connect.facebook.net**", "**facebook.com**"]) {
  await ctx.route(host, r => r.abort());
}

const logs = [];
page.on("console", m => logs.push(m.text()));

await page.goto(`${BASE}/experiences.html?gclid=TESTGCLID&utm_source=google&utm_campaign=summer2026`);
await page.waitForTimeout(600);

const cookies = async () => Object.fromEntries((await ctx.cookies()).map(c => [c.name, c.value]));

// 1. before consent: nothing may be stored on the device
let c = await cookies();
ok("no attribution cookie before consent", !c.cb_attr, c.cb_attr);

// ...so the click id has to travel inside the links instead
const internal = await page.getAttribute('a[href$="about.html"], a[href*="about.html"]', "href");
ok("internal link carries gclid before consent", internal.includes("gclid=TESTGCLID"), internal);

// 2. booking links carry it to the Wix site
const href = await page.getAttribute('a[href*="book.chifbay.com"]', "href");
ok("booking link carries gclid", href.includes("gclid=TESTGCLID"), href);
ok("booking link carries utm_campaign", href.includes("utm_campaign=summer2026"), href);
ok("booking link keeps its own params", href.includes("timezone="), href);

// 3. consent banner
ok("banner shown", await page.isVisible("#cb-consent"));
const denied = await page.evaluate(() => window.dataLayer.find(a => a[0] === "consent" && a[1] === "default")?.[2]);
ok("consent denied by default", denied && denied.ad_storage === "denied", JSON.stringify(denied));

await page.click("#cb-consent button:last-child"); // Accept
await page.waitForTimeout(200);
c = await cookies();
ok("consent cookie granted", c.cb_consent === "granted", c.cb_consent);
const upd = await page.evaluate(() => window.dataLayer.filter(a => a[0] === "consent" && a[1] === "update").pop()?.[2]);
ok("consent update pushed", upd && upd.ad_storage === "granted", JSON.stringify(upd));
ok("banner gone after choice", !(await page.isVisible("#cb-consent")));

// 3b. only now is the attribution allowed on disk
const attr = JSON.parse(decodeURIComponent(c.cb_attr || "{}"));
ok("gclid stored after consent", attr.gclid === "TESTGCLID", JSON.stringify(attr));
ok("utm_campaign stored after consent", attr.utm_campaign === "summer2026");
ok("first_seen recorded", !!attr.first_seen);

// 4. events — stop the navigation, keep the click
await page.evaluate(() => document.addEventListener("click", e => {
  const a = e.target.closest("a[href]"); if (a) e.preventDefault();
}));

await page.click('a[href*="private-sunset-cruise"]');
await page.waitForTimeout(150);
let ev = await page.evaluate(() => window.dataLayer.filter(a => a[0] === "event").map(a => [a[1], a[2]]));
const checkout = ev.find(e => e[0] === "begin_checkout");
ok("begin_checkout fired", !!checkout, JSON.stringify(ev));
ok("begin_checkout has the sunset price", checkout && checkout[1].value === 400, JSON.stringify(checkout));

await page.click('a[href*="wa.me/"]');
await page.waitForTimeout(150);
ev = await page.evaluate(() => window.dataLayer.filter(a => a[0] === "event").map(a => a[1]));
ok("whatsapp click fired", ev.includes("contact_whatsapp"), JSON.stringify(ev));

// 5. a later plain visit must not wipe the attribution
const p2 = await ctx.newPage();

await p2.goto(`${BASE}/about.html`);
await p2.waitForTimeout(400);
c = await cookies();
const attr2 = JSON.parse(decodeURIComponent(c.cb_attr || "{}"));
ok("plain visit keeps the gclid", attr2.gclid === "TESTGCLID", JSON.stringify(attr2));
ok("no second banner after choosing", !(await p2.isVisible("#cb-consent")));

// 6. a page deep in /posts/ loads the same absolute file
const p3 = await ctx.newPage();
let served = false;
p3.on("request", r => { if (r.url().endsWith("/track.js")) served = true; });

await p3.goto(`${BASE}/posts/top-10-beaches-in-madeira.html`);
await p3.waitForTimeout(400);
ok("/posts/ page loads track.js from the site root", served);

// 7. On the Wix booking site the tags are Wix's, so we must speak consent but
//    never configure the ids again. Faked by telling track.js that this host
//    IS the booking host.
const BOOKING_SRC = SRC.replace('BOOKING_HOST: "book.chifbay.com"', 'BOOKING_HOST: "127.0.0.1"');
const bctx = await browser.newContext();
await bctx.route("**/track.js", r =>
  r.fulfill({ contentType: "application/javascript", body: BOOKING_SRC }));
let loadedGtagJs = false;
const bp = await bctx.newPage();
bp.on("request", r => { if (r.url().includes("googletagmanager.com/gtag/js")) loadedGtagJs = true; });
for (const host of ["**googletagmanager.com**", "**google-analytics.com**", "**googleadservices.com**",
                    "**connect.facebook.net**", "**facebook.com**"]) {
  await bctx.route(host, r => r.abort());
}

await bp.goto(`${BASE}/index.html`);
await bp.waitForTimeout(600);

const dl = await bp.evaluate(() => (window.dataLayer || []).map(a => Array.from(a)));
ok("booking site still sets consent defaults",
  dl.some(a => a[0] === "consent" && a[1] === "default" && a[2].ad_storage === "denied"), JSON.stringify(dl));
ok("booking site does NOT config the ids again",
  !dl.some(a => a[0] === "config"), JSON.stringify(dl));
ok("booking site does not load gtag.js", !loadedGtagJs);
ok("booking site still asks for consent", await bp.isVisible("#cb-consent"));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
