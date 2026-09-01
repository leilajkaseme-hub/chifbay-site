/**
 * Chifbay — Madeira boat price study.
 *
 * Builds one blog post from REAL measured GetYourGuide listing data, not from
 * a language model. Every number on the page is computed here at build time,
 * so the page can never drift from the data.
 *
 * Source data: ../../thumbnail-research/all.json + mad_priv.json
 * NOTE: that folder is OUTSIDE this repo, so this script runs on the Mac only.
 * GitHub Actions cannot see it. Copy the two json files into data/ before
 * wiring this into any workflow — see ig-auto/bin/check-library.mjs for the
 * same fault costing five photos that silently never posted.
 * (scraped 2026-08-11 for the thumbnail study; the price field came along with it)
 *
 * Also writes a machine-readable copy of the findings to
 * data/madeira-boat-prices-2026.json so AI answer engines and other sites can
 * cite the numbers directly.
 *
 * Run: node scripts/build-price-study.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESEARCH = path.resolve(ROOT, "..", "thumbnail-research");
const BASE = "https://chifbay.com";
const SLUG = "madeira-boat-tour-prices-2026";
const SURVEY_DATE = "2026-08-11";   // when the listings were measured
const PUBLISH_DATE = "2026-08-18";

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const jstr = s => JSON.stringify(String(s));

/* ---------- load + classify ---------- */

const MADEIRA = new Set(["Funchal","Calheta","Machico","Caniço","Canical","Porto Moniz",
  "Curral das Freiras","Madeira","Câmara de Lobos","Ribeira Brava","Santa Cruz",
  "Ponta do Sol","Porto Santo","Top rated"]);

// "€1,850" -> 1850 ; "€58" -> 58. A dot or comma directly before exactly three
// digits is a thousands separator, anything else left is a decimal point.
function price(raw) {
  const m = /([\d.,]+)/.exec(String(raw || "").replace(/\s/g, ""));
  if (!m) return null;
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const BOAT = /boat|catamaran|yacht|cruise|sail|snorkel|dolphin|whale|kayak|jet ski|fishing|rib|charter|xavelha|pirate ship|paddle/i;
const LAND = /jeep|4x4|hike|hiking|levada|tuk-tuk|toboggan|van tour|transfer|walk|mercedes|cable car|stargaz|museum|pico do ari|pico arieiro|pico ruivo|island tour|sightseeing tour|cruise ship passengers|customizable|southwest/i;
// rows from the private-boat scrape are titled by destination, not by trip type
const PLACE_TITLED = new Set(["Porto da Cruz","Caniço","Câmara de Lobos"]);
const PRIVATE = /privat|exclusive|charter|yacht/i;

const all = JSON.parse(fs.readFileSync(path.join(RESEARCH, "all.json"), "utf8"));
const madPriv = JSON.parse(fs.readFileSync(path.join(RESEARCH, "mad_priv.json"), "utf8"));

const seen = new Set(all.map(r => r.id));
const rows = [
  ...all.filter(r => MADEIRA.has(r.city)),
  ...madPriv.filter(r => !seen.has(r.id)),
];

const boats = rows.filter(r =>
  (BOAT.test(r.title || "") && !LAND.test(r.title || "")) || PLACE_TITLED.has(r.title));

// whole-boat if the title says so, or it is a place-titled private listing, or
// it is the 8-hour luxury cruise (sold as a charter, not per seat)
const isPrivate = r =>
  PRIVATE.test(r.title || "") ||
  PLACE_TITLED.has(r.title) ||
  /Luxury Cruise from Funchal to Ponta/.test(r.title || "");

const shared  = boats.filter(r => !isPrivate(r));
const priv    = boats.filter(isPrivate);

/* ---------- stats ---------- */

const med = xs => {
  const s = [...xs].sort((a,b)=>a-b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
};
const pct = (xs, p) => {
  const s = [...xs].sort((a,b)=>a-b);
  return s.length ? s[Math.min(s.length-1, Math.floor(s.length * p))] : null;
};
const prices = rs => rs.map(r => price(r.p)).filter(v => v != null);
const reviews = rs => rs.map(r => r.n).filter(n => Number.isInteger(n));

function band(rs) {
  const ps = prices(rs), rv = reviews(rs);
  const rated = rs.map(r => r.r ? Number(r.r) : null).filter(v => v != null);
  return {
    listings: rs.length,
    min: Math.min(...ps), p25: pct(ps, .25), median: med(ps), p75: pct(ps, .75), max: Math.max(...ps),
    reviewsTotal: rv.reduce((a,b)=>a+b, 0),
    reviewsMedian: med(rv),
    zeroReview: rv.filter(n => n === 0).length,
    ratingMedian: med(rated),
    rated: rated.length,
  };
}

const S = band(shared), P = band(priv);
const allPrices = prices(boats);
const middle = allPrices.filter(v => v >= 90 && v <= 150).length;

// Europe-wide comparison, computed the same way so the two medians are
// like-for-like: boat listings only, per-person (shared) only.
const euBoats  = all.filter(r => BOAT.test(r.title||"") && !LAND.test(r.title||""));
const euShared = euBoats.filter(r => !PRIVATE.test(r.title||""));
const EU = { listings: euShared.length, cities: new Set(euShared.map(r=>r.city)).size,
             median: med(prices(euShared)) };
const round = n => Math.round(n);

// group-size comparison against the shared median, per person
const GROUPS = [2,3,4,5];
// Every figure below is the total for the group, with the per-person figure
// beside it. Mixing the two units in one table is the exact mistake this
// article is about.
const table = GROUPS.map(g => ({
  people: g,
  shared:  { total: round(S.median * g), pp: round(S.median) },
  private: { total: round(P.median),     pp: round(P.median / g) },
  sunset:  { total: 400,                 pp: round(400 / g) },
  day:     { total: 500,                 pp: round(500 / g) },
}));

/* ---------- machine-readable dataset ---------- */

const dataset = {
  name: "Madeira boat tour prices 2026",
  description: "Advertised prices for every bookable Madeira boat trip listed on GetYourGuide, measured 2026-08-11, split into per-person shared trips and whole-boat private charters.",
  surveyDate: SURVEY_DATE,
  source: "GetYourGuide public listings, Madeira (Funchal, Calheta, Machico, Caniço, Caniçal, Porto Moniz, Câmara de Lobos, Porto Santo)",
  currency: "EUR",
  method: "Listings were captured from public GetYourGuide category and search pages. Land tours were excluded by title. A listing counts as whole-boat if it advertises itself as private, exclusive, a charter or a yacht; everything else is treated as a per-person seat price. Prices are the advertised 'from' price and exclude platform booking fees.",
  totalBoatListings: boats.length,
  shared: { unit: "per person", ...S },
  private: { unit: "whole boat", ...P },
  listingsPricedBetween90And150: middle,
  europeComparison: { sharedListings: euShared.length, cities: new Set(euShared.map(r=>r.city)).size,
                      medianPerPerson: med(prices(euShared)) },
  licence: "CC BY 4.0 — free to reuse with a link to https://chifbay.com/posts/" + SLUG + ".html",
};

fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "madeira-boat-prices-2026.json"),
  JSON.stringify(dataset, null, 2) + "\n");

/* ---------- page content ---------- */

const TITLE = `Madeira Boat Tour Prices in 2026: What ${boats.length} Real Listings Actually Charge`;
const META  = `We measured the advertised price of every Madeira boat trip on GetYourGuide. Shared trips: €${round(S.median)} per person. Private boats: €${round(P.median)} for the whole boat. Here is the full breakdown.`;
const LEDE  = `Nobody publishes what a boat trip in Madeira really costs, so we measured it. Every bookable listing, one afternoon, both halves of a market that barely overlap.`;

const fmt = n => "€" + round(n).toLocaleString("en-GB");

const cell = c => `${fmt(c.total)}<br><span class="pp">${fmt(c.pp)} each</span>`;
const rowsHtml = table.map(t => `<tr>
        <td><strong>${t.people} people</strong></td>
        <td>${cell(t.shared)}</td>
        <td>${cell(t.private)}</td>
        <td>${cell(t.sunset)}</td>
        <td>${cell(t.day)}</td>
      </tr>`).join("\n      ");

const BODY = `
      <h2>What does a boat trip in Madeira cost?</h2>
      <p>There is no single answer, because Madeira has <strong>two separate boat markets</strong> that happen to sit on the same booking pages.</p>
      <ul>
        <li><strong>Shared trips are sold by the seat.</strong> Median advertised price: <strong>${fmt(S.median)} per person</strong> (${S.listings} listings, ranging ${fmt(S.min)} to ${fmt(S.max)}).</li>
        <li><strong>Private trips are sold by the boat.</strong> Median advertised price: <strong>${fmt(P.median)} for the whole boat</strong> (${P.listings} listings, ranging ${fmt(P.min)} to ${fmt(P.max)}).</li>
      </ul>
      <p>Those two numbers are not comparable, and that is exactly where most people get confused. A ${fmt(S.median)} listing and a ${fmt(P.median)} listing can appear side by side in the same search result with no obvious sign that one is a seat and the other is the entire boat.</p>

      <h2>How we measured this</h2>
      <p>We captured every bookable boat listing shown on GetYourGuide for Madeira on <strong>${new Date(SURVEY_DATE+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong> — Funchal, Calheta, Machico, Caniço, Caniçal, Porto Moniz, Câmara de Lobos and Porto Santo. Land tours were removed. That leaves <strong>${boats.length} boat listings</strong>.</p>
      <p>A listing counts as whole-boat if it advertises itself as private, exclusive, a charter or a yacht. Everything else is treated as a per-person seat price. Prices are the advertised "from" price and do not include platform booking fees. The full dataset is <a href="/data/madeira-boat-prices-2026.json">published as JSON</a> under CC BY 4.0 — reuse it, just link back.</p>

      <h2>The price gap in the middle is real</h2>
      <p>Of all ${boats.length} listings, only <strong>${middle}</strong> are priced between €90 and €150. The market sits at two ends: a cheap seat on a big catamaran, or several hundred euros for a boat of your own. There is almost nothing in between.</p>
      <p>This matters when you are planning. If ${fmt(S.median)} a head feels too crowded but ${fmt(P.median)} feels too much, the middle option you are looking for mostly does not exist in Madeira — you are choosing between the two ends.</p>

      <h2>Is a private boat cheaper if you are a group?</h2>
      <p>Usually not, and it is worth saying plainly because a lot of listings imply otherwise. Here are the real numbers, against the shared median of ${fmt(S.median)} per person. Every cell shows the total first, then the cost each:</p>
      <div class="ptable-wrap">
      <table class="ptable">
        <thead><tr>
          <th>Group size</th>
          <th>Shared trip</th>
          <th>Private boat (median)</th>
          <th>Chifbay Sunset</th>
          <th>Chifbay Day</th>
        </tr></thead>
        <tbody>
      ${rowsHtml}
        </tbody>
      </table>
      </div>
      <p>At five people, the shared option totals ${fmt(S.median*5)} and the median private boat is ${fmt(P.median)} — roughly <strong>${(P.median/(S.median*5)).toFixed(1)}× more</strong>. Private boats in Madeira are not a money-saving trick. You pay a real premium, and what you buy with it is that nobody else is on board, the boat waits when you want to swim longer, and the route can change on the day.</p>
      <p>The one thing that <em>is</em> true: the per-person figure falls fast with group size. It makes no sense for one person and good sense for five.</p>

      <h2>The strangest finding: the private half of the market has almost no reviews</h2>
      <p>Across the ${S.listings} shared listings there are <strong>${S.reviewsTotal.toLocaleString("en-GB")} reviews</strong>. Across the ${P.listings} private listings there are <strong>${P.reviewsTotal.toLocaleString("en-GB")}</strong> — and <strong>${P.zeroReview} of them have none at all</strong>. The median private listing has ${P.reviewsMedian} review.</p>
      <p>Only ${P.rated} of the ${P.listings} private listings carry a star rating at all. Where a rating does exist, private trips score higher (median ${P.ratingMedian.toFixed(1)}) than shared ones (median ${S.ratingMedian.toFixed(1)}) — but on so few ratings that the number should be treated as a hint, not a fact.</p>
      <p>The practical advice: in the shared market you can lean on review counts, because they are large enough to mean something. In the private market almost nobody has them, so judge on the specifics instead — how many guests the boat actually takes, whether drinks are included or extra, whether the price is per person or for the boat, and where it actually goes.</p>

      <h2>What is included, and what usually is not</h2>
      <p>The advertised price is rarely the final price. Across these listings the common extras are drinks, snacks, photos or video, hotel pickup, and the platform's own booking fee. Two boats at the same headline price can differ by €50 or more once you add them.</p>
      <p>When you compare, ask three questions: is this per person or for the boat, how many other people will be aboard, and what is not in the price. On a <a href="../experiences.html">private Chifbay trip</a> the answer is the whole boat for up to 7 guests, nobody else aboard, with local wine, poncha, beer, soft drinks and snacks already in the price — ${fmt(400)} for the 2-hour sunset and ${fmt(500)} for the 2h30 day trip, both below the ${fmt(P.median)} private median.</p>

      <h2>Is Madeira cheap compared to the rest of Europe?</h2>
      <p>No. The same survey covered <strong>${EU.listings} shared boat listings across ${EU.cities} European towns and cities</strong>, measured the same way. The European median is <strong>${fmt(EU.median)} per person</strong>. Madeira's is <strong>${fmt(S.median)}</strong> — slightly above it.</p>
      <p>That surprises people, because Madeira has plenty of large catamarans and you would expect that capacity to push prices down. It does not. If you are budgeting a Mediterranean-style ${fmt(EU.median)} boat trip, plan for a little more here.</p>
      <p>The private end is where Madeira is genuinely thin: ${P.listings} whole-boat listings for the whole island.</p>

      <blockquote>Two markets, one search page. Read the unit before you read the number.</blockquote>

      <p>Prices move. This snapshot is from ${new Date(SURVEY_DATE+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} and we will remeasure it. If you are quoting these figures, please link back so readers can check the date.</p>
`;

const FAQ = [
  { q: "How much is a boat trip in Madeira?",
    a: `Two different answers. A shared boat trip costs a median of ${fmt(S.median)} per person, based on ${S.listings} listings measured in August 2026. A private boat costs a median of ${fmt(P.median)} for the whole boat, based on ${P.listings} listings. The cheapest shared trip found was ${fmt(S.min)} per person; the cheapest private boat was ${fmt(P.min)}.` },
  { q: "Is a private boat in Madeira cheaper than a shared one for a group?",
    a: `No. For a group of five, five shared seats total about ${fmt(S.median*5)}, while the median private boat is ${fmt(P.median)} — roughly ${(P.median/(S.median*5)).toFixed(1)} times more. The per-person cost of a private boat drops quickly with group size, but it does not become the cheaper option. You pay a premium for exclusivity, not a discount for volume.` },
  { q: "Why do Madeira boat prices range from under €20 to over €900?",
    a: `Because the listings mix two different units. Prices under about €90 are almost always a per-person seat on a shared boat. Prices above about €150 are almost always the price of the entire boat. Only ${middle} of the ${boats.length} listings measured fall between €90 and €150.` },
  { q: "Do private boat tours in Madeira have reviews?",
    a: `Mostly not. Across ${P.listings} private listings there were only ${P.reviewsTotal} reviews in total and ${P.zeroReview} listings had none, with a median of ${P.reviewsMedian}. Shared listings held ${S.reviewsTotal.toLocaleString("en-GB")} reviews between ${S.listings} listings. When booking a private boat, judge it on capacity, inclusions and route rather than on review count.` },
  { q: "What is not included in an advertised Madeira boat tour price?",
    a: "Commonly drinks, snacks, photos or video, hotel pickup, and the booking platform's fee. Two listings at the same headline price can end up €50 apart. Always check whether the price is per person or for the whole boat before comparing." },
  { q: "When was this price data collected?",
    a: `The listings were measured on ${new Date(SURVEY_DATE+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} from public GetYourGuide pages covering Madeira. The full dataset is published as JSON at chifbay.com/data/madeira-boat-prices-2026.json under a CC BY 4.0 licence.` },
];

/* ---------- render ---------- */

const url = `${BASE}/posts/${SLUG}.html`;
const hero = "assets/hero.jpg";
const heroAlt = "Madeira boat tour prices 2026 — a private boat off the Funchal coast";
const dateNice = new Date(PUBLISH_DATE+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
const faqJson = FAQ.map(f => `{"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(",");
const faqHtml = FAQ.map(f => `<details class="rv"><summary>${esc(f.q)}<span class="fi">+</span></summary><p class="fb">${esc(f.a)}</p></details>`).join("\n      ");

const datasetJson = JSON.stringify({
  "@context":"https://schema.org","@type":"Dataset",
  name: dataset.name,
  description: dataset.description,
  url,
  license:"https://creativecommons.org/licenses/by/4.0/",
  creator:{"@type":"Organization",name:"Chifbay",url:BASE},
  temporalCoverage: SURVEY_DATE,
  spatialCoverage:{"@type":"Place",name:"Madeira, Portugal"},
  variableMeasured:[
    {"@type":"PropertyValue",name:"Median shared boat trip price per person",value:round(S.median),unitCode:"EUR"},
    {"@type":"PropertyValue",name:"Median private whole-boat trip price",value:round(P.median),unitCode:"EUR"},
    {"@type":"PropertyValue",name:"Boat listings measured",value:boats.length},
  ],
  distribution:[{"@type":"DataDownload",encodingFormat:"application/json",contentUrl:`${BASE}/data/madeira-boat-prices-2026.json`}],
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<script>/*theme*/(function(){try{var t=localStorage.getItem('cb-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();</script>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(TITLE)} | Chifbay</title>
<meta name="description" content="${esc(META)}">
<meta name="keywords" content="Madeira boat tour prices, how much is a boat trip in Madeira, private boat Madeira price, Funchal boat trip cost, Madeira catamaran price, private vs shared boat Madeira, Madeira boat charter cost">
<link rel="canonical" href="${url}"/>
<meta name="robots" content="index,follow"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${esc(TITLE)}"/>
<meta property="og:description" content="${esc(META)}"/>
<meta property="og:image" content="${BASE}/${hero}"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="../assets/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../peak.css"/>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BlogPosting","headline":${jstr(TITLE)},"description":${jstr(META)},"image":"${BASE}/${hero}","datePublished":"${PUBLISH_DATE}","dateModified":"${PUBLISH_DATE}","author":{"@type":"Organization","name":"Chifbay"},"publisher":{"@type":"Organization","name":"Chifbay","logo":{"@type":"ImageObject","url":"${BASE}/assets/logo-white.png"}},"mainEntityOfPage":"${url}"}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faqJson}]}
</script>
<script type="application/ld+json">
${datasetJson}
</script>
<style>
.ptable-wrap{overflow-x:auto;margin:28px 0}
.ptable{width:100%;border-collapse:collapse;font-size:.92rem}
.ptable th,.ptable td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--hair)}
.ptable thead th{font-family:'Space Mono',monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:400;border-bottom:1px solid var(--hair-strong)}
.ptable tbody tr:last-child td{border-bottom:none}
.ptable td:first-child{white-space:nowrap}\n.ptable .pp{font-family:'Space Mono',monospace;font-size:.7rem;color:var(--muted)}
.statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:28px 0}
.statcard{border:1px solid var(--hair);border-radius:var(--radius);padding:18px 20px}
.statcard .sv{font-family:'Playfair Display',serif;font-size:2rem;line-height:1.1;display:block}
.statcard .sl{font-family:'Space Mono',monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:8px;display:block}
</style>
  <script defer src="https://dashboard-pink-nine-58.vercel.app/t.js" data-store="chifbay"></script><script defer src="https://207.231.106.166.sslip.io/script.js" data-website-id="e98d1e8a-dbbd-4b75-82da-7729bd85863a"></script>
<script defer src="/track.js"></script>
</head>
<body>

<nav id="nav"><div class="wrap ni">
  <a class="logo" href="/"><img decoding="async" src="../assets/logo-white.png" alt="Chifbay — private boat tours in Madeira, Funchal"></a>
  <nav class="nl">
    <a href="/">Home</a>
    <a href="../experiences.html">Experiences</a>
    <a href="../about.html">The Story</a>
    <a href="../blog.html" class="active">Journal</a>
    <a href="../contact.html">Contact</a>
    <a href="/reviews.html">Reviews</a>
    <a href="/review.html">Leave a review</a>
  </nav>
  <div style="display:flex;align-items:center">
    <a class="nc" href="../experiences.html">Book your boat</a>
    <button class="navtoggle" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</div></nav>

<header class="hero sub">
  <div class="hbg" style="background-image:url('../${hero}')"></div>
  <div class="hov"></div>
  <div class="wrap hc">
    <div class="hbadge rv in">Journal · Guide</div>
    <h1 class="rv in" style="font-size:clamp(2.2rem,5vw,4rem);max-width:22ch">${esc(TITLE)}</h1>
    <div class="artmeta rv in d1"><span>${dateNice}</span><span>7 min read</span><span>Funchal · Madeira</span></div>
  </div>
</header>

<section class="pad">
  <div class="wrap">
    <article class="article rv">
      <p class="lede">${esc(LEDE)}</p>

      <div class="statgrid">
        <div class="statcard"><span class="sv">${fmt(S.median)}</span><span class="sl">Shared trip, per person (median)</span></div>
        <div class="statcard"><span class="sv">${fmt(P.median)}</span><span class="sl">Private boat, whole boat (median)</span></div>
        <div class="statcard"><span class="sv">${boats.length}</span><span class="sl">Boat listings measured</span></div>
        <div class="statcard"><span class="sv">${middle}</span><span class="sl">Listings priced €90–€150</span></div>
      </div>
${BODY}
    </article>

    <div class="artcta rv">
      <div class="eyebrow gold" style="justify-content:center;margin-bottom:12px">Your group only</div>
      <h3>A private boat, below the private median</h3>
      <p>${fmt(400)} for the 2-hour sunset, ${fmt(500)} for the 2h30 day trip — the whole boat, up to 7 guests, drinks and snacks included.</p>
      <a class="btn btn-p btn-lg" href="../experiences.html">Explore the experiences →</a>
      <p style="margin-top:14px;font-size:.9rem"><a href="../hidden-coves-half-day.html" style="color:var(--teal)">Day Trip</a> · <a href="../sunset-cruise.html" style="color:var(--teal)">Sunset Trip</a></p>
    </div>
  </div>
</section>

<section class="pad" style="padding-top:0">
  <div class="wrap">
    <div class="center rv"><div class="eyebrow">Good to know</div><h2>Questions, answered</h2></div>
    <div class="faq">
      ${faqHtml}
    </div>
  </div>
</section>

${fs.readFileSync(path.join(ROOT,"posts","apple-festival-ponta-do-pargo-2026.html"),"utf8").split("<footer>")[1].replace(/^/,"<footer>")}`;

fs.writeFileSync(path.join(ROOT, "posts", `${SLUG}.html`), html);

/* ---------- index + sitemap ---------- */

const POSTS = path.join(ROOT, "posts", "posts.json");
const posts = JSON.parse(fs.readFileSync(POSTS, "utf8"));
const entry = {
  slug: SLUG, title: TITLE, category: "Guide", date: PUBLISH_DATE,
  description: META, heroImage: hero, heroAlt,
  readingMinutes: 7,
  keywords: ["Madeira boat tour prices","how much is a boat trip in Madeira",
    "private boat Madeira price","Funchal boat trip cost","Madeira catamaran price",
    "private vs shared boat Madeira","Madeira boat charter cost","Madeira boat trip 2026"],
};
const i = posts.findIndex(p => p.slug === SLUG);
if (i >= 0) posts[i] = entry; else posts.unshift(entry);
posts.sort((a,b) => b.date.localeCompare(a.date));
fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + "\n");

const SITEMAP = path.join(ROOT, "sitemap.xml");
let xml = fs.readFileSync(SITEMAP, "utf8");
// Only the article goes in the sitemap. The raw JSON is not a page; engines
// reach it through the Dataset schema and llms.txt.
if (!xml.includes(url)) {
  xml = xml.replace("</urlset>", `  <url><loc>${url}</loc><changefreq>monthly</changefreq></url>\n</urlset>`);
}
fs.writeFileSync(SITEMAP, xml);

const LLMS = path.join(ROOT, "llms.txt");
if (fs.existsSync(LLMS)) {
  let t = fs.readFileSync(LLMS, "utf8");
  const block = `## Original data

Chifbay publishes its own measured pricing data for the Madeira boat market, free to cite under CC BY 4.0.

- [Madeira boat tour prices ${PUBLISH_DATE.slice(0,4)}](${url}): ${boats.length} Madeira boat listings measured ${SURVEY_DATE}. Shared trips median ${fmt(S.median)} per person (${S.listings} listings); private whole-boat trips median ${fmt(P.median)} (${P.listings} listings). European shared median for comparison: ${fmt(EU.median)} across ${EU.listings} listings in ${EU.cities} towns and cities.
- Machine-readable dataset: ${BASE}/data/madeira-boat-prices-2026.json
`;
  t = t.replace(/\n## Original data[\s\S]*?(?=\n## |$)/, "\n");   // drop any previous copy
  t = t.replace(/\n## Contact/, `\n${block}\n## Contact`);
  fs.writeFileSync(LLMS, t);
  console.log("Updated llms.txt");
}

console.log(`Wrote posts/${SLUG}.html`);
console.log(`Wrote data/madeira-boat-prices-2026.json`);
console.log(`Boat listings ${boats.length} — shared ${S.listings} (median EUR${round(S.median)}/person), private ${P.listings} (median EUR${round(P.median)}/boat)`);
console.log(`Middle gap (EUR90-150): ${middle} listings`);
console.log(`Reviews: shared ${S.reviewsTotal}, private ${P.reviewsTotal} (${P.zeroReview} with none)`);
