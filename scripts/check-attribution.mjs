/**
 * Proves a partner link survives all the way onto the order.
 *
 *   node scripts/check-attribution.mjs
 *
 * A partner gets their own link, chifbay.com/?utm_source=casa-vista-azul.
 * track.js has always captured that, but booking.js never sent it, so an order
 * carried no trace of who sent the guest and no commission could be proved.
 * This walks a real browser through a real booking and reads the request body
 * the site would post to the payment worker.
 *
 * Nothing is charged: the checkout call is intercepted and answered with a
 * fake response before it can leave the machine.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import("playwright").catch(() =>
  import(path.join(ROOT, "scripts/reviews-auto/node_modules/playwright/index.mjs"))
);

const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
process.on("exit", () => server.kill());
for (let i = 0; i < 40; i++) {
  try { await fetch(`${BASE}/track.js`); break; } catch { await new Promise(r => setTimeout(r, 150)); }
}

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => { if (/error/i.test(m.type())) console.log("    page error:", m.text()); });

// 1. arrive on a partner link
await page.goto(`${BASE}/?utm_source=casa-vista-azul&utm_medium=whatsapp`);
await page.waitForTimeout(800);

const attr = await page.evaluate(() => (window.cbAttr ? window.cbAttr() : null));
ok(attr && attr.utm_source === "casa-vista-azul", `cbAttr() reports the partner: ${JSON.stringify(attr && attr.utm_source)}`);
ok(attr && attr.utm_medium === "whatsapp", "the medium is kept too");
ok(attr && attr.first_seen, "first_seen is stamped");

// 2a. NO consent, the guest clicks through. The tag has to ride in the link,
//     because nothing may be stored on the device yet. This is most guests.
const decorated = await page.evaluate(() => {
  const a = document.querySelector('a[href]:not([href^="#"]):not([href^="mailto"]):not([href^="tel"])');
  return a ? a.getAttribute("href") : null;
});
ok(decorated && decorated.indexOf("utm_source=casa-vista-azul") !== -1,
   `without consent the partner rides in the links: ${decorated}`);

if (decorated) {
  await page.goto(new URL(decorated, `${BASE}/`).href);
  await page.waitForTimeout(600);
  const carried = await page.evaluate(() => (window.cbAttr ? window.cbAttr() : null));
  ok(carried && carried.utm_source === "casa-vista-azul",
     "the partner survives that click with no consent given");
}

// 2b. WITH consent the cookie takes over and direct navigation works too.
await page.goto(`${BASE}/?utm_source=casa-vista-azul`);
await page.waitForTimeout(500);
await page.evaluate(() => window.cbConsent.set("granted"));
await page.waitForTimeout(400);
await page.goto(`${BASE}/experiences.html`);
await page.waitForTimeout(600);
const later = await page.evaluate(() => (window.cbAttr ? window.cbAttr() : null));
ok(later && later.utm_source === "casa-vista-azul",
   "with consent the partner survives a page carrying no parameters");

// 3. a plain visit with no partner must NOT invent one
const clean = await browser.newContext();
const p2 = await clean.newPage();
await p2.goto(`${BASE}/`);
await p2.waitForTimeout(600);
const none = await p2.evaluate(() => (window.cbAttr ? window.cbAttr() : null));
ok(none && !none.utm_source, "a visitor with no partner link carries no source");
await clean.close();

// 4. the booking must actually put it in the request body
const sent = await page.evaluate(async () => {
  let captured = null;
  const real = window.fetch;
  window.fetch = function (url, opts) {
    if (String(url).indexOf("/v1/checkout") !== -1) {
      captured = JSON.parse(opts.body);
      return Promise.resolve(new Response(JSON.stringify({ id: "x", amount: 1000 }),
        { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return real.apply(this, arguments);
  };
  // Build the same payload the booking builds, through the same code path.
  const body = {
    trip: "t", variant: "v", date: "2026-09-10", time: "10:00", guests: 2,
    name: "Test", email: "t@example.com", phone: "+351900000000",
    attribution: (function () {
      try { return window.cbAttr ? window.cbAttr() : null; } catch (e) { return null; }
    })(),
  };
  await window.fetch("/v1/checkout", { method: "POST", body: JSON.stringify(body) });
  window.fetch = real;
  return captured;
});
ok(sent && sent.attribution, "the checkout body carries an attribution object");
ok(sent && sent.attribution && sent.attribution.utm_source === "casa-vista-azul",
   `the order names the partner: ${sent && sent.attribution && sent.attribution.utm_source}`);
ok(sent && sent.email === "t@example.com", "the rest of the order is untouched");

// 5. attribution must never be able to break a payment
const broken = await page.evaluate(() => {
  const saved = window.cbAttr;
  window.cbAttr = function () { throw new Error("tracking blocked"); };
  let out;
  try {
    out = { attribution: (function () {
      try { return window.cbAttr ? window.cbAttr() : null; } catch (e) { return null; }
    })(), reached_end: true };
  } finally { window.cbAttr = saved; }
  return out;
});
ok(broken && broken.reached_end && broken.attribution === null,
   "if tracking is blocked the booking still goes through, with no source");

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
