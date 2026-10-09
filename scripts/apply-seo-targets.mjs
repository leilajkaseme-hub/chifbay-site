#!/usr/bin/env node
// apply-seo-targets.mjs: puts the keyword map (scripts/data/seo-targets.json)
// on the existing target pages.
//
//   node scripts/apply-seo-targets.mjs           dry run
//   node scripts/apply-seo-targets.mjs --write   apply   (safe to run again)
//
// What it does:
//   1. <title> and meta description of each existing target page from the map,
//      and the same values into scripts/data/meta-short.json, so
//      shorten-meta.mjs never writes the old ones back.
//   2. A JSON-LD block between <!-- seo:ld --> markers: WebPage with
//      dateModified, BreadcrumbList, and TouristTrip on the trip pages that
//      had none (sunset, day trip). Prices from booking-api/catalog.js.
//   3. The home pages (6 languages): logo and the full sameAs list on the
//      LocalBusiness and the Organization. No aggregateRating is added.
//   4. Every page: the old Google Maps cid in JSON-LD becomes the one the
//      footer links to (11236673311781793484, the live Google profile).
// The new landing pages are not touched here: build-seo-pages.mjs owns them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SITE = "https://chifbay.com";
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/data/seo-targets.json"), "utf8"));
const MODIFIED = MAP.updated;
const BIZ = { "@id": `${SITE}/#business` };
const OLD_CID = "https://www.google.com/maps?cid=11229657632154885978";
const NEW_CID = "https://maps.google.com/?cid=11236673311781793484";
const SAME_AS = [
  "https://www.instagram.com/chifbay",
  "https://www.facebook.com/profile.php?id=61593099213659",
  "https://www.tiktok.com/@chifbay",
  NEW_CID,
  "https://www.tripadvisor.com/Attraction_Review-g189167-d34387047.html",
  "https://www.getyourguide.com/funchal-l1026/private-dolphin-and-whale-watching-madeira-t1342812/",
  "https://www.getyourguide.com/funchal-l1026/madeira-private-yacht-cruise-with-drinks-and-snacks-t1340940/",
  "https://www.getyourguide.com/funchal-l1026/luxury-sunset-yacht-experience-madeira-t1314963/",
  "https://www.getyourguide.com/funchal-l1026/romantic-sunset-cruise-madeira-private-yacht-t1342794/",
  "https://apps.apple.com/app/id6811650007",
];
const LOGO = `${SITE}/assets/logo-dark.png`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const crumb = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${href}` })) });
const stops = (names) => ({ "@type": "ItemList", itemListElement: names.map((name, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Place", name } })) });
const offer = (name, price, href) => ({ "@type": "Offer", name, price: String(price), priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${SITE}${href}` });

// extra JSON-LD per page (WebPage is added to every one)
const EXTRA = {
  "index.html": { lang: "en", url: "/", nodes: [] },
  "de/index.html": { lang: "de", url: "/de/", nodes: [] },
  "fr/index.html": { lang: "fr", url: "/fr/", nodes: [] },
  "experiences.html": { lang: "en", url: "/experiences", nodes: [crumb([["Home", "/"], ["Madeira boat trips", "/experiences"]])] },
  "private-boat-tour-madeira.html": { lang: "en", url: "/private-boat-tour-madeira", about: "#trip", nodes: [crumb([["Home", "/"], ["Experiences", "/experiences"], ["Private boat tour Madeira", "/private-boat-tour-madeira"]])] },
  "sunset-cruise.html": { lang: "en", url: "/sunset-cruise", about: "#trip", nodes: [
    { "@type": "TouristTrip", "@id": `${SITE}/sunset-cruise#trip`, name: "Private sunset cruise from Funchal, Madeira",
      description: "Private sunset boat trip from Marina do Funchal along Madeira's west coast. Leaves 1 h 15 before sunset: 2 h to Cabo Girão or 2 h 30 to Ribeira Brava. Drinks, food and complimentary Portuguese wine on deck, Insta360 360° video, drone footage (weather allowing) and camera photos. Whole boat for up to 5 guests, two local skippers.",
      url: `${SITE}/sunset-cruise`, image: `${SITE}/assets/exp-sunset.jpg`, touristType: ["Couples", "Families", "Small groups"], provider: BIZ,
      itinerary: stops(["Marina do Funchal, Pontoon C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres (2 h 30 only)", "Ribeira Brava (2 h 30 only)"]),
      offers: [offer("Sunset cruise 2 h, turns at Cabo Girão", 400, "/book-sunset?v=cabo-girao"), offer("Sunset cruise 2 h 30, on to Ribeira Brava", 500, "/book-sunset?v=ribeira-brava")] },
    crumb([["Home", "/"], ["Experiences", "/experiences"], ["Sunset cruise", "/sunset-cruise"]])] },
  "hidden-coves-half-day.html": { lang: "en", url: "/hidden-coves-half-day", about: "#trip", nodes: [
    { "@type": "TouristTrip", "@id": `${SITE}/hidden-coves-half-day#trip`, name: "Private day boat trip from Funchal with swim and paddle",
      description: "Private day trip by boat from Marina do Funchal at 10:00 or 14:00: Câmara de Lobos, Cabo Girão with the drone, swim and paddle at Fajã dos Padres, a second swim at Ribeira Brava, on to Ponta do Sol on the 3 h. Drinks and food, Insta360 360° video, drone footage (weather allowing), camera photos. Whole boat for up to 5 guests.",
      url: `${SITE}/hidden-coves-half-day`, image: `${SITE}/assets/exp-coves.jpg`, touristType: ["Couples", "Families", "Small groups"], provider: BIZ,
      itinerary: stops(["Marina do Funchal, Pontoon C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava", "Ponta do Sol (3 h only)"]),
      offers: [offer("Day trip 2 h 30, to Ribeira Brava", 500, "/book-day?v=ribeira-brava"), offer("Day trip 3 h, to Ponta do Sol", 600, "/book-day?v=ponta-do-sol")] },
    crumb([["Home", "/"], ["Experiences", "/experiences"], ["Day boat trip", "/hidden-coves-half-day"]])] },
};

const metaShortFile = path.join(ROOT, "scripts/data/meta-short.json");
const metaShort = JSON.parse(fs.readFileSync(metaShortFile, "utf8"));
let metaChanged = false;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || ["node_modules", "scripts", "ig", "social", "social-drive", "zz-test", "vendor", "assets"].includes(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel); else if (e.name.endsWith(".html")) files.push(rel);
  }
})("");

let changed = 0;
const LDRE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
for (const rel of files) {
  const before = fs.readFileSync(path.join(ROOT, rel), "utf8");
  let h = before;
  const target = MAP.pages[rel];
  const extra = EXTRA[rel];

  // 4. old Maps cid, inside JSON-LD only
  h = h.replace(LDRE, (m) => m.split(OLD_CID).join(NEW_CID));

  if (target && !target.new) {
    // 1. title + description, and keep meta-short.json in step
    h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(target.title)}</title>`);
    h = h.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + escAttr(target.description) + b);
    const want = { ...(metaShort[rel] || {}), title: target.title, description: target.description };
    if (JSON.stringify(metaShort[rel]) !== JSON.stringify(want)) { metaShort[rel] = want; metaChanged = true; }
  }

  // 3. home pages: logo + sameAs on the business and the organization
  if (/^(?:[a-z]{2}\/)?index\.html$/.test(rel) && !rel.startsWith("posts")) {
    h = h.replace(LDRE, (m, body) => {
      let d; try { d = JSON.parse(body); } catch { return m; }
      let touched = false;
      for (const n of d["@graph"] || [d]) {
        const t = [].concat(n["@type"] || []);
        if (t.includes("LocalBusiness") || t.includes("Organization")) {
          if (n.logo !== LOGO) { n.logo = LOGO; touched = true; }
          if (JSON.stringify(n.sameAs) !== JSON.stringify(SAME_AS)) { n.sameAs = SAME_AS; touched = true; }
          if (t.includes("LocalBusiness") && !n.areaServed) { n.areaServed = { "@type": "AdministrativeArea", name: "Madeira" }; touched = true; }
        }
      }
      return touched ? `<script type="application/ld+json">${JSON.stringify(d)}</script>` : m;
    });
  }

  // 2. the seo:ld block
  if (extra) {
    const url = `${SITE}${extra.url}`;
    const page = { "@type": "WebPage", "@id": `${url}#webpage`, url, name: target.title, description: target.description, inLanguage: extra.lang, dateModified: MODIFIED, publisher: BIZ };
    if (extra.about) page.about = { "@id": `${url.replace(/\/$/, "")}${extra.about}` };
    const block = `<!-- seo:ld -->\n<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [page, ...extra.nodes] })}</script>\n<!-- /seo:ld -->`;
    if (h.includes("<!-- seo:ld -->")) h = h.replace(/<!-- seo:ld -->[\s\S]*?<!-- \/seo:ld -->/, block);
    else {
      const at = h.search(/<link rel="alternate" hreflang=|<script defer src="https:\/\/dashboard/);
      if (at < 0) throw new Error(`${rel}: no place for the seo:ld block`);
      h = h.slice(0, at) + block + "\n" + h.slice(at);
    }
  }

  for (const m of h.matchAll(LDRE)) JSON.parse(m[1]);
  if (h !== before) { changed++; console.log(`change: ${rel}`); if (WRITE) fs.writeFileSync(path.join(ROOT, rel), h); }
}
if (metaChanged) { console.log("change: scripts/data/meta-short.json"); if (WRITE) fs.writeFileSync(metaShortFile, JSON.stringify(metaShort, null, 1) + "\n"); }
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s).`);
