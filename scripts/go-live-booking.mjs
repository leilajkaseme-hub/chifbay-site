/* Switch the site from "booking goes to Wix" to "booking happens here".
 *
 * Run ONLY after the live Stripe secret is in Cloudflare, otherwise real
 * customers meet a test-mode payment form and pay nothing.
 *
 *   node scripts/go-live-booking.mjs           # show what would change
 *   node scripts/go-live-booking.mjs --write   # do it
 *
 * It does four things:
 *   1. publishable key  pk_test_… -> pk_live_…
 *   2. removes the noindex lines from book.html and booking-done.html
 *   3. points every "Check availability" link at /book.html
 *   4. corrects the privacy pages, which currently name Wix as the place
 *      payments happen
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const WRITE = process.argv.includes("--write");
const ROOT = new URL("..", import.meta.url).pathname;

const PK_LIVE =
  "pk_live_51U2w9pJxD5EYSiY2dfmzIX2AUaly4adM9TXYnLZPcbXTWe2HL5SjtpMC0SfpfUpPVEuwUox5HpuvnwCtOxjG7jfn00XBM3uQi2";

// The booking page only exists in English for now, so every language sends
// people to the same place. Better a working English page than a dead link.
const NEW_HREF = "/book.html";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "vendor", ".git", "print", "scripts", "social", "assets"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".html") out.push(p);
  }
  return out;
}

let changed = 0;
const report = [];

function edit(path, fn) {
  const before = readFileSync(path, "utf8");
  const after = fn(before);
  if (after === before) return;
  changed++;
  report.push(path.replace(ROOT, ""));
  if (WRITE) writeFileSync(path, after);
}

// 1. the publishable key
edit(join(ROOT, "booking-config.js"), (s) =>
  s.replace(/window\.CHIFBAY_STRIPE_PK\s*=\s*"pk_test_[^"]*"/, `window.CHIFBAY_STRIPE_PK = "${PK_LIVE}"`)
);

// 2 + 3 + 4, across every page
for (const file of walk(ROOT)) {
  edit(file, (s) => {
    // let Google in
    s = s.replace(/^.*<meta name="robots" content="noindex,nofollow">\n/gm, "");
    s = s.replace(/^\s*<!-- Kept out of Google until the payment is live\. Delete this line to launch\. -->\n/gm, "");

    // send the CTAs to our own page
    s = s.replace(
      /href="https:\/\/book\.chifbay\.com\/booking-calendar\/[^"]*"(\s+target="_blank"\s+rel="noopener")?/g,
      `href="${NEW_HREF}"`
    );

    // the privacy pages named Wix as the payment processor
    s = s.replace(
      /our booking provider on <strong>book\.chifbay\.com<\/strong>/g,
      "Stripe, our payment provider"
    );
    s = s.replace(
      /Because our booking site \(book\.chifbay\.com\) sits on the same domain, your choice and your vi/g,
      "Because booking happens on this same site, your choice and your vi"
    );
    return s;
  });
}

console.log(
  (WRITE ? "Changed " : "Would change ") + changed + " file(s):\n  " + report.join("\n  ")
);
if (!WRITE) console.log("\nNothing written. Re-run with --write when the live key is in Cloudflare.");
