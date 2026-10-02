// run-summary.mjs <site dir>: one JSON line for the run report
// (run-local-reviews-sync.sh -> /v1/ingest/reviews): per source, how many
// reviews this run fetched and the newest date among them, and what the
// built reviews.json now publishes.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const site = process.argv[2] || join(HERE, "..", "..");
const read = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const newest = (l) => l.reduce((m, r) => (r.date > m ? r.date : m), "") || null;
const files = { gyg: "gyg-reviews.json", google: "google-reviews.json", tripadvisor: "tripadvisor-reviews.json" };
const fetched = {};
for (const [k, f] of Object.entries(files)) {
  const l = read(join(HERE, "data", f), []);
  fetched[k] = { n: l.length, newest: newest(l) };
}
const pub = read(join(site, "reviews.json"), { reviews: [] });
const by = {};
for (const r of pub.reviews || []) { by[r.source] = by[r.source] || []; by[r.source].push(r); }
const published = { count: (pub.reviews || []).length, bySource: Object.fromEntries(Object.entries(by).map(([k, l]) => [k, { n: l.length, newest: newest(l) }])) };
process.stdout.write(JSON.stringify({ fetched, published }));
