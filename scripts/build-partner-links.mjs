/**
 * Build the short link each partner hands out: chifbay.com/<slug>
 *
 *   node scripts/build-partner-links.mjs
 *
 * The page does three things and then gets out of the way:
 *   1. tells the Worker a guest arrived on that partner's link
 *   2. forwards to the trips page carrying utm_source=<slug>
 *   3. works with JavaScript switched off, through a meta refresh
 *
 * WHY NOT SET A COOKIE HERE
 * track.js already owns attribution and deliberately does not store anything
 * before the visitor accepts cookies; until then it carries the tag in the
 * links instead. Writing a 90 day cookie here would quietly undo that, so this
 * page passes the tag in the URL and lets track.js apply its own rule. The tag
 * still survives 90 days once consent is given, which is ATTR_DAYS.
 *
 * The slugs come from the Worker's partner registry so the two cannot drift:
 * a link that exists here but not there records no visit, and the partner
 * would see zero for weeks with nothing obviously broken.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://chifbay-booking-api.chifandcopt.workers.dev";
const TARGET = "/experiences.html";

// Read the registry rather than keep a second copy of the slugs.
const src = readFileSync(join(ROOT, "..", "booking-api", "partners.js"), "utf8");
const slugs = [...src.matchAll(/^\s{2}"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]);
const names = Object.fromEntries(
  [...src.matchAll(/^\s{2}"([a-z0-9-]+)":\s*\{\s*\n\s*name:\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]])
);
if (!slugs.length) { console.error("no partners found in partners.js"); process.exit(1); }

const page = (slug, name) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Chifbay</title>
<link rel="canonical" href="https://chifbay.com${TARGET}">
<meta http-equiv="refresh" content="0;url=${TARGET}?utm_source=${slug}">
<style>
  :root { color-scheme: light dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#0b1f2a; color:#eaf2f6 }
  a { color:#7fd4ff }
  .b { text-align:center; padding:2rem }
</style>
</head><body>
<div class="b">
  <p>Chifbay</p>
  <p><a href="${TARGET}?utm_source=${slug}">Continue to the trips</a></p>
</div>
<script>
(function () {
  var slug = ${JSON.stringify(slug)};
  // Fire and forget. A blocked beacon must never delay the guest, and a guest
  // who arrives is worth more than the record that they did.
  try {
    var body = JSON.stringify({ slug: slug, path: location.pathname });
    // text/plain, not application/json, and this is the whole reason the
    // first version recorded nothing. application/json is not a CORS simple
    // content type, so the browser wants a preflight, and sendBeacon cannot
    // perform one. The beacon was dropped silently, with no error anywhere:
    // every partner would have seen zero visits for ever while the page
    // looked perfectly healthy. The Worker parses the text itself.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(${JSON.stringify(API + "/v1/visit")},
        new Blob([body], { type: "text/plain;charset=UTF-8" }));
    } else {
      fetch(${JSON.stringify(API + "/v1/visit")},
        { method: "POST", body: body, keepalive: true, mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=UTF-8" } });
    }
  } catch (e) {}
  location.replace(${JSON.stringify(TARGET + "?utm_source=")} + encodeURIComponent(slug));
})();
</script>
</body></html>
`;

let n = 0;
for (const slug of slugs) {
  if (slug === "zz-test") { /* keep the test lane reachable too */ }
  const dir = join(ROOT, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page(slug, names[slug] || slug));
  console.log(`  chifbay.com/${slug}`.padEnd(40) + (names[slug] || ""));
  n++;
}
console.log(`\n${n} short link(s) written`);
