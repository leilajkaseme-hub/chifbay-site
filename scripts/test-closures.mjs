/* Does the booking calendar really close the days booking-config.js says?
 *
 * This exists because the booking page cannot be opened locally: the Worker
 * refuses cross-origin calls from localhost, so the calendar never renders and
 * a wrong closure rule would only ever show up on the live site, on a page
 * that takes money.
 *
 * It reads the real isClosed/applyClosures out of booking.js rather than a
 * copy, so it fails if that code changes shape.
 *
 *   node scripts/test-closures.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "booking.js"), "utf8");
const cfgSrc = readFileSync(join(root, "booking-config.js"), "utf8");

const fns = src.match(
  /function isClosed\(date, tripId\) \{[\s\S]*?\n {2}\}\n\n {2}function applyClosures\(days, tripId\) \{[\s\S]*?\n {2}\}/
);
if (!fns) {
  console.error("Could not find isClosed/applyClosures in booking.js. If they were");
  console.error("renamed or reshaped, update this test - do not delete it.");
  process.exit(1);
}

const closed = cfgSrc.match(/window\.CHIFBAY_CLOSED\s*=\s*\[[\s\S]*?\];/);
if (!closed) { console.error("No window.CHIFBAY_CLOSED in booking-config.js"); process.exit(1); }

/* new Function, not eval: inside an ES module a function declaration created by
   eval is not visible to the module scope. */
const window = {};
new Function("window", closed[0])(window);
const { isClosed, applyClosures } =
  new Function("window", fns[0] + "\nreturn { isClosed: isClosed, applyClosures: applyClosures };")(window);
void isClosed;

/* Trip ids the Worker publishes. A rule naming anything else closes nothing,
   which is the safe direction, but it is silent - so check for it. */
const TRIPS = ["day-trip", "sunset"];
let bad = 0;
for (const r of window.CHIFBAY_CLOSED) {
  if (r.trips === "all") continue;
  for (const id of r.trips || []) {
    if (!TRIPS.includes(id)) {
      console.error(`Rule ${r.from}..${r.to} names an unknown trip "${id}" - it closes nothing.`);
      bad++;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to) || r.to < r.from) {
    console.error(`Rule ${r.from}..${r.to} has bad dates.`);
    bad++;
  }
}

/* What we believe we published, written out day by day. Update this table when
   the closures change - that is the point of it. */
const EXPECT = {
  "day-trip": { open: ["2026-09-05", "2026-09-19", "2026-09-20"],
                shut: ["2026-09-06", "2026-09-12", "2026-09-17", "2026-09-18"] },
  "sunset":   { open: ["2026-09-05", "2026-09-18", "2026-09-20"],
                shut: ["2026-09-06", "2026-09-12", "2026-09-17", "2026-09-19"] },
};

const every = {};
for (let d = 1; d <= 30; d++) every[`2026-09-${String(d).padStart(2, "0")}`] = ["x"];

for (const trip of TRIPS) {
  const got = applyClosures(every, trip);
  for (const day of EXPECT[trip].open) {
    if (!got[day]) { console.error(`${trip}: ${day} should be OPEN and is closed.`); bad++; }
  }
  for (const day of EXPECT[trip].shut) {
    if (got[day]) { console.error(`${trip}: ${day} should be CLOSED and is open.`); bad++; }
  }
}

/* A day the API never offered must stay absent, closure rule or not - the API
   is still the authority on everything except our own closures. */
if (Object.keys(applyClosures({ "2026-09-21": ["x"] }, "sunset")).includes("2026-09-22")) {
  console.error("applyClosures invented a day the API did not send."); bad++;
}

if (bad) { console.error(`\n${bad} problem(s).`); process.exit(1); }
console.log("closures OK — day-trip shut 6-18, sunset shut 6-17 and 19, sunset open on the 18th.");
