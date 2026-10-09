#!/usr/bin/env node
// build-seo-pages.mjs: the landing pages made for Google searches nothing else
// on the site answered (audit of 4 Oct 2026, google.com Portugal, logged out).
//
//   node scripts/build-seo-pages.mjs           dry run, lists what would change
//   node scripts/build-seo-pages.mjs --write   write the pages
//
// Pages (see scripts/data/seo-targets.json for the search each one answers):
//   cabo-girao-boat-tour.html             cabo girao boat tour
//   faja-dos-padres-boat-trip.html        faja dos padres boat trip
//   boat-rental-with-skipper-funchal.html boat rental with skipper funchal
//   best-boat-trips-madeira.html          best boat trips madeira (comparison)
//   de/private-boat-tour-madeira.html     private bootstour madeira
//   fr/private-boat-tour-madeira.html     excursion bateau privé madère
//
// The look is not copied by hand: the head scripts, the menu, the footer, the
// "Included" media block, the route map and the sticky booking bar are read
// from the same language's sunset-cruise.html each run, so a later change to
// those blocks reaches these pages on the next run. Prices come from
// booking-api/catalog.js (copied below, checked against the live pages by
// tide.js through data-cb-price). Safe to run again: same input, same output.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SITE = "https://chifbay.com";
const MODIFIED = "2026-10-09";
const BIZ = { "@id": `${SITE}/#business` };
const WA = "https://wa.me/351937200320";

// prices from booking-api/catalog.js, EUR, whole boat, up to 5 guests
const P = { sunset2: 400, sunset25: 500, day25: 500, day3: 600 };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const pick = (s, re, what) => { const m = s.match(re); if (!m) throw new Error(`template: no ${what}`); return m[0]; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// tags out, entities in: the text a search engine reads in JSON-LD
const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// ---------- pieces borrowed from the language's sunset-cruise.html ----------
function template(lang) {
  const pre = lang === "en" ? "" : `${lang}/`;
  const h = read(`${pre}sunset-cruise.html`);
  return {
    top: pick(h, /^[\s\S]*?<meta name="viewport"[^>]*>\n/, "head top"),
    fonts: pick(h, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"\/>[\s\S]*?atlas\.min\.css"\/>\n/, "fonts"),
    headTail: pick(h, /[ \t]*<script defer src="https:\/\/dashboard[\s\S]*?<\/head>/, "head tail").replace(/^[ \t]+/, ""),
    nav: pick(h, /<nav id="nav">[\s\S]*?<\/div><\/nav>/, "nav"),
    media: pick(h, /<!-- media-included -->[\s\S]*?<!-- \/media-included -->/, "media block"),
    route: pick(h, /<!-- tide:route -->[\s\S]*?<!-- \/tide:route -->/, "route block"),
    tail: pick(h, /<footer>[\s\S]*$/, "footer"),
  };
}

const LANGNAMES = [["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"], ["es", "Español"], ["it", "Italiano"]];

// ---------- small HTML helpers in the trip page markup ----------
const A = (p, name) => `${p}assets/${name}`;
const bgVars = (p, n) => `--bg:url('${A(p, n)}.jpg');--bgw:image-set(url('${A(p, n)}.webp') type('image/webp'),url('${A(p, n)}.jpg') type('image/jpeg'))`;
const pic = (p, n, alt, w, h) => `<picture style="display:block;height:100%"><source type="image/webp" srcset="${A(p, n)}.webp"><img src="${A(p, n)}.jpg" alt="${esc(alt)}" loading="lazy" decoding="async"${w ? ` width="${w}" height="${h}"` : ""}></picture>`;
const arrow = `<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const tick = `<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON = {
  drink: `<svg class="ic" viewBox="0 0 32 32"><path d="M8 5h16l-2 9a6 6 0 0 1-12 0zM16 20v6M11 27h10"/></svg>`,
  drone: `<svg class="ic" viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M6 6h4M22 6h4M6 26h4M22 26h4M8 4v4M24 4v4M8 24v4M24 24v4M12 16h-2M22 16h-2"/></svg>`,
  heart: `<svg class="ic" viewBox="0 0 32 32"><path d="M16 27S6 20 6 13a6 6 0 0 1 10-4 6 6 0 0 1 10 4c0 7-10 14-10 14z"/></svg>`,
  wave: `<svg class="ic" viewBox="0 0 32 32"><path d="M3 20c3 0 3-3 6.5-3s3.5 3 6.5 3 3-3 6.5-3 3.5 3 6.5 3M3 26c3 0 3-3 6.5-3s3.5 3 6.5 3 3-3 6.5-3 3.5 3 6.5 3M16 4v9M12 9l4 4 4-4"/></svg>`,
  crew: `<svg class="ic" viewBox="0 0 32 32"><circle cx="11" cy="10" r="4"/><circle cx="22" cy="10" r="4"/><path d="M4 26c0-4 3-7 7-7s7 3 7 7M15 26c0-4 3-7 7-7s7 3 7 7"/></svg>`,
  boat: `<svg class="ic" viewBox="0 0 32 32"><path d="M4 20h24l-3 6H8zM8 20l2-7h10l4 7M14 13V7"/></svg>`,
};

function hero(p, c) {
  return `<header class="hero sub t-frame">
  <div class="hero-media">
    <div class="hbg" role="img" aria-label="${esc(c.heroAlt)}" style="background-image:url('${A(p, c.heroImg)}.jpg');background-image:image-set(url('${A(p, c.heroImg)}.webp') type('image/webp'),url('${A(p, c.heroImg)}.jpg') type('image/jpeg'))"></div>
  </div>
  <div class="hov"></div>
  <div class="wrap-w hc">
    <div class="hbadge">${c.badge}</div>
    <h1 data-mask>${c.h1}</h1>
    <p class="hsub">${c.hsub}</p>
    <div class="hact">
      <a class="btn btn-p btn-lg" href="${c.book}">${c.bookLabel}
        ${arrow}</a>
      <a class="btn btn-g btn-lg" href="${WA}" target="_blank" rel="noopener">${c.waLabel}</a>
    </div>
    <div class="tour-meta">
${c.meta.map(([k, v]) => `      <div class="tm"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("\n")}
    </div>
  </div>
</header>`;
}

function ed(p, s) {
  return `<section class="chapter"${s.top0 ? ' style="padding-top:0"' : ""}>
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">${s.n}</span><span class="cl">${s.label}</span></div>
    <div class="ed2${s.flip ? " flip" : ""}">
      <div class="col-t">
        <h2 class="reveal" data-mask>${s.h2}</h2>
${s.paras.map((t, i) => `        <p class="reveal d${Math.min(i + 1, 3)}">${t}</p>`).join("\n")}${s.cta ? `\n        <a class="btn btn-p reveal d3" href="${s.cta[0]}">${s.cta[1]}\n          ${arrow}</a>` : ""}
      </div>
      <div class="col-v stack">
        <div class="fig lead-fig clip" style="aspect-ratio:4/5">${pic(p, s.img, s.alt)}
          <span class="fig-cap">${s.cap}</span></div>
      </div>
    </div>
  </div>
</section>`;
}

function opts(s) {
  return `<section class="chapter" style="padding-top:0" id="options">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">${s.n}</span><span class="cl">${s.label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:10px">${s.h2}</h2>
    <p class="reveal d1" style="max-width:52ch;color:var(--mist)">${s.lead}</p>
    <div class="opts">
${s.cards.map((o, i) => `      <div class="opt reveal${i ? " d1" : ""}">
        <div class="odur">${o.dur}</div>
        <h3>${o.h3}</h3>
        <div class="oturn">${o.turn}</div>
        <div class="oprice"${o.live ? ` data-cb-price="${o.live}"` : ""}>${o.price}</div>
        <div class="ounit">${o.unit}</div>
        <ul>
${o.li.map((t) => `          <li>${tick}${t}</li>`).join("\n")}
        </ul>
        <a class="btn btn-p" href="${o.href}">${o.btn}
          ${arrow}</a>${o.more ? `\n        <p class="bk-hint"><a href="${o.more[0]}">${o.more[1]}</a></p>` : ""}
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}

const feat = (items) => `<section>
  <div class="wrap-w">
    <div class="feat">
${items.map(([ic, h, t], i) => `      <div class="ft reveal${i ? ` d${i}` : ""}">
        ${ICON[ic]}
        <h3>${h}</h3>
        <p>${t}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;

const timeline = (s) => `<section class="chapter" style="padding-top:0">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">${s.n}</span><span class="cl">${s.label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:12px">${s.h2}</h2>${s.lead ? `\n    <p class="reveal d1" style="max-width:56ch;color:var(--mist)">${s.lead}</p>` : ""}
    <div class="tl reveal">
${s.items.map(([t, ic, h, d]) => `      <div class="tli" data-ic="${ic}"><div class="tlt">${t}</div><div class="tlc"><h4>${h}</h4><p>${d}</p></div></div>`).join("\n")}
    </div>
  </div>
</section>`;

const faq = (s) => `<section class="chapter" style="padding-top:0" id="faq">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">${s.n}</span><span class="cl">${s.label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:8px">${s.h2}</h2>
    <div class="faq">
${s.items.map(([q, a]) => `      <details class="reveal"><summary>${q}<span class="fi">+</span></summary><p class="fb">${a}</p></details>`).join("\n")}
    </div>
  </div>
</section>`;

const reserve = (p, r) => `<section class="reserve" id="reserve">
  <div class="im" style="${bgVars(p, r.img)}" data-lzbg></div>
  <div class="ov"></div>
  <canvas class="t-caustic" aria-hidden="true"></canvas>
  <div class="wrap-w rc">
    <div class="lbl reveal">${r.lbl}</div>
    <h2 class="reveal" data-mask>${r.h2}</h2>
    <p class="reveal d1">${r.p}</p>
    <div class="cact reveal d1">
      <a class="btn btn-p btn-lg" href="${r.book}">${r.bookLabel}
        ${arrow}</a>
      <a class="btn btn-g btn-lg" href="${WA}" target="_blank" rel="noopener">${r.wa}</a>
    </div>
    <div class="alt reveal d2">${r.call} · <a href="tel:+351937200320">+351 937 200 320</a></div>
  </div>
</section>`;

// ---------- JSON-LD ----------
function ld(c) {
  const url = `${SITE}/${c.slug}`;
  const g = [{
    "@type": "WebPage", "@id": `${url}#webpage`, url, name: plain(c.title), description: plain(c.description),
    inLanguage: c.lang, dateModified: MODIFIED, primaryImageOfPage: `${SITE}/assets/${c.heroImg}.jpg`,
    publisher: BIZ, ...(c.trip ? { about: { "@id": `${url}#trip` } } : {}),
  }];
  if (c.trip) g.push({
    "@type": "TouristTrip", "@id": `${url}#trip`, name: c.trip.name, description: c.trip.description, url,
    image: `${SITE}/assets/${c.heroImg}.jpg`, touristType: c.trip.touristType || ["Couples", "Families", "Small groups"],
    provider: BIZ,
    itinerary: { "@type": "ItemList", itemListElement: c.trip.stops.map((name, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Place", name } })) },
    offers: c.trip.offers.map(([name, price, href]) => ({ "@type": "Offer", name, price: String(price), priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${SITE}${href}` })),
  });
  if (c.article) g.push({
    "@type": "Article", "@id": `${url}#article`, headline: plain(c.h1Plain || c.title), description: plain(c.description),
    image: `${SITE}/assets/${c.heroImg}.jpg`, inLanguage: c.lang, datePublished: c.article.published, dateModified: MODIFIED,
    author: BIZ, publisher: BIZ, mainEntityOfPage: { "@id": `${url}#webpage` },
  });
  g.push({
    "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
    itemListElement: c.crumbs.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${href}` })),
  });
  if (c.faq) g.push({
    "@type": "FAQPage", "@id": `${url}#faq`,
    mainEntity: c.faq.items.map(([q, a]) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
  });
  return `<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": g })}\n</script>`;
}

// ---------- one page ----------
function render(c) {
  const t = template(c.lang);
  const p = c.slug.includes("/") ? "../" : "";
  const url = `${SITE}/${c.slug}`;
  const alts = c.alternates || [[c.lang, c.slug]];
  const hreflang = [...alts, ["x-default", alts.find(([l]) => l === "en")?.[1] || c.slug]]
    .map(([l, s]) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${s}"/>`).join("\n");
  // menu: language switcher points at this page in each language it exists in, else that language's home
  const langmenu = LANGNAMES.map(([l, name]) => {
    const own = alts.find(([al]) => al === l);
    return `<a href="/${own ? own[1] : l === "en" ? "" : `${l}/`}">${name}</a>`;
  }).join("");
  let nav = t.nav.replace(/<div class="langmenu">[\s\S]*?<\/div>/, `<div class="langmenu">${langmenu}</div>`)
    .replace(/<span class="langcode">[A-Z]{2}<\/span>/, `<span class="langcode">${c.lang.toUpperCase()}</span>`);
  // set-main-nav.mjs marks the active item only on the pages it knows: none of these
  nav = nav.replace(/ class="active" aria-current="page"/, "");
  const tail = t.tail.replace(/<!-- tide:sbar -->[\s\S]*?<!-- \/tide:sbar -->/,
    `<!-- tide:sbar -->\n<div class="t-sbar" role="region" aria-label="${c.sbar.aria}"><div><span class="t-sbar-k">${c.sbar.k}</span><span class="t-sbar-v"${c.sbar.live ? ` data-cb-price="${c.sbar.live}"` : ""}>${c.sbar.v}</span></div><a class="btn" href="${c.sbar.href}">${c.sbar.label} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>\n<!-- /tide:sbar -->`);
  const body = c.sections(p, t).join("\n\n");
  return `${t.top.replace(/<html lang="[a-z]+"/, `<html lang="${c.lang}"`)}<title>${c.title}</title>
<link rel="icon" href="${p}assets/favicon.ico" sizes="any"/>
<link rel="icon" type="image/png" sizes="32x32" href="${p}assets/favicon-32.png"/>
<link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png"/>
<meta name="description" content="${c.description}">
<link rel="canonical" href="${url}"/>
<meta property="og:title" content="${c.title}"/>
<meta property="og:description" content="${c.description}"/>
<meta property="og:image" content="${SITE}/assets/${c.heroImg}.jpg"/>
<meta property="og:type" content="${c.article ? "article" : "website"}"/>
<meta name="twitter:card" content="summary_large_image"/>
${t.fonts}<link rel="preload" as="image" type="image/webp" href="${p}assets/${c.heroImg}.webp"/>
${c.css ? `<style>${c.css}</style>\n` : ""}${ld(c)}
${hreflang}
${t.headTail}
<body>

${nav}

${hero(p, c)}

${body}

${tail}`;
}

// ---------------------------------------------------------------- content
const EN_SBAR = (live, v, href) => ({ aria: "Choose a date", k: "From", v, live, href, label: "Book now" });
const EN_RESERVE = { lbl: "Marina do Funchal · Pontoon C", wa: "Message the skippers", call: "Or call directly" };
const EN_CRUMBS = (name, slug) => [["Home", "/"], ["Experiences", "/experiences"], [name, `/${slug}`]];

const PAGES = [];

// 1. Cabo Girão ------------------------------------------------------------
PAGES.push({
  slug: "cabo-girao-boat-tour", lang: "en",
  title: "Cabo Girão Boat Tour from Funchal · Private Boat | Chifbay",
  description: "Private Cabo Girão boat tour from Funchal: the 580 m sea cliff seen from below, drone footage of your boat, drinks and food. Up to 5 guests from €400.",
  heroImg: "g-cliff-portrait", heroAlt: "The Chifbay private boat at the foot of the Cabo Girão sea cliff, Madeira",
  badge: "Private boat · Funchal to Cabo Girão",
  h1: "Cabo Girão<br><em>boat tour</em>",
  hsub: "A private Cabo Girão boat tour from Funchal: 9 km west along the coast to the foot of a 580 metre sea cliff, with the drone up over your boat. Every Chifbay trip goes there, from €400 for the whole boat.",
  book: "/book", bookLabel: "Check dates &amp; book", waLabel: "Ask the skippers",
  meta: [["From", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["By sea", "9 km from Funchal"], ["Guests", "Up to 5"], ["Trips", "Day or sunset"]],
  trip: {
    name: "Private Cabo Girão boat tour from Funchal",
    description: "Private boat trip from Marina do Funchal west to the foot of Cabo Girão, the 580 m sea cliff, past Câmara de Lobos. Drone footage at the cliff (weather allowing), Insta360 360° video, camera photos, drinks and food. Whole boat for up to 5 guests, two local skippers.",
    stops: ["Marina do Funchal, Pontoon C", "Câmara de Lobos", "Cabo Girão"],
    offers: [["Sunset 2 h, turns at Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao"], ["Sunset 2 h 30, on to Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava"], ["Day trip 2 h 30, Cabo Girão and a swim at Fajã dos Padres", P.day25, "/book-day?v=ribeira-brava"], ["Day trip 3 h, on to Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol"]],
  },
  crumbs: EN_CRUMBS("Cabo Girão boat tour", "cabo-girao-boat-tour"),
  sbar: EN_SBAR("sunset", `€${P.sunset2}`, "/book"),
  faq: {
    n: "05", label: "Good to know", h2: "Cabo Girão by boat: questions",
    items: [
      ["How long does it take to reach Cabo Girão by boat from Funchal?", "About 45 minutes at an easy pace. It is 9 km by sea from Marina do Funchal, and we pass Câmara de Lobos on the way. On the day trip we are under the cliff about 45 minutes after leaving: 10:45 on the 10:00 slot."],
      ["Which Chifbay trip goes to Cabo Girão?", `All of them. The <a href="sunset-cruise">sunset cruise</a> turns at Cabo Girão on the 2 h option (€${P.sunset2}) and carries on to Ribeira Brava on the 2 h 30 (€${P.sunset25}). The <a href="hidden-coves-half-day">day trip</a> stops under the cliff and then swims at Fajã dos Padres (€${P.day25} or €${P.day3}).`],
      ["Can we swim at Cabo Girão?", `The swim stop is a few minutes further west, at <a href="faja-dos-padres-boat-trip">Fajã dos Padres</a>, on the day trip only. The water there is calmer and clear, and the paddle boards come out. The sunset cruise does not stop to swim.`],
      ["Is the skywalk or the boat better?", "They show two different things. The glass skywalk at the top shows the drop. The boat shows the cliff itself, from the waterline up, and the terraces of Fajã dos Padres at its foot. If you have time, do both."],
      ["Do you fly the drone at the cliff?", "Yes, on every trip, weather allowing. You also get an Insta360 360° video and high quality photos taken with a real camera, sent to you after the trip."],
      ["What does it cost?", `One flat price for the whole boat, up to 5 guests: from €${P.sunset2} for the 2 h sunset cruise to €${P.day3} for the 3 h day trip. Free cancellation up to 24 hours before departure.`],
    ],
  },
  sections: (p, t) => [
    ed(p, { n: "01", label: "The cliff from below", h2: "580 metres,<br>seen from the sea",
      paras: [
        "Cabo Girão is a wall of volcanic rock about 580 metres high, one of the highest sea cliffs in Europe. Most people see it from the glass skywalk at the top, looking down. From a boat you see the rest: the whole face above you, the layers of basalt, and the small farmed terraces at its foot.",
        "We leave Marina do Funchal and run west past <strong>Câmara de Lobos</strong>, the fishing village Churchill came to paint. About 9 km out, the cliff fills the view. We slow down under it, the drinks and food come out, and the skippers fly the drone so you leave with footage of your boat and the cliff behind it, weather allowing.",
      ],
      cta: ["#options", "See which trip to pick"],
      img: "g-cliff-portrait", alt: "Chifbay boat tour under Cabo Girão, the 580 m sea cliff west of Funchal", cap: "Under Cabo Girão · drone footage included" }),
    opts({ n: "02", label: "Two ways to go", h2: "Every trip reaches Cabo Girão",
      lead: "Choose by time of day. The sunset cruise is for the light and a drink on deck; the day trip adds a swim just past the cliff.",
      cards: [
        { dur: "Evening · 2 h or 2 h 30", h3: "Sunset cruise", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava on the 2 h 30", price: `€${P.sunset2}`, live: "sunset", unit: "From · whole boat · up to 5",
          li: ["Leaves 1 h 15 before sunset, so the light is right all year", "Cabo Girão from the water, drone up over the boat", "Drinks, food and complimentary Portuguese wine on deck", `2 h turns at the cliff (€${P.sunset2}), 2 h 30 goes on to Ribeira Brava (€${P.sunset25})`],
          href: "/book-sunset?v=cabo-girao", btn: "Book the sunset cruise", more: ["sunset-cruise", "Read about the sunset cruise"] },
        { dur: "10:00 or 14:00 · 2 h 30 or 3 h", h3: "Day trip with a swim", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "From · whole boat · up to 5",
          li: ["Under Cabo Girão with the drone up at about 10:45 or 14:45", "Swim, jump in and paddle at Fajã dos Padres", "A second swim stop at Ribeira Brava", `3 h option goes on to Ponta do Sol (€${P.day3})`],
          href: "/book-day?v=ribeira-brava", btn: "Book the day trip", more: ["hidden-coves-half-day", "Read about the day trip"] },
      ] }),
    feat([
      ["drone", "Drone at the cliff", "The skippers fly the drone over your boat under Cabo Girão, weather allowing, and send you the footage."],
      ["drink", "Drinks &amp; food aboard", "Served on deck under the cliff, on every trip. Nothing extra to pay."],
      ["crew", "Two local skippers", "Licensed and from Madeira. They know where the cliff looks best in each light."],
    ]),
    ed(p, { n: "03", label: "What you see on the way", h2: "Funchal to Cabo Girão<br>in 9 km", flip: true, top0: true,
      paras: [
        "The run starts along the Funchal waterfront. At 6 km you pass <strong>Câmara de Lobos</strong>, with its painted fishing boats and the bay that made it famous. Then the coast rises and the houses stop.",
        "At 9 km the cliff is straight above you. From the water you can read it: dark and light bands of rock, green ledges in the cracks, and at the bottom, the vines and banana terraces of <a href=\"faja-dos-padres-boat-trip\">Fajã dos Padres</a>, which you can only reach by boat or by cable car.",
      ],
      img: "exp-coastal", alt: "The Chifbay boat off Câmara de Lobos on the way to Cabo Girão", cap: "Câmara de Lobos, 6 km from the marina" }),
    t.route,
    timeline({ n: "04", label: "The run, step by step", h2: "Funchal to the cliff and back", lead: "Times for the day trip on the 10:00 slot. The sunset cruise runs the same coast, leaving 1 h 15 before sunset.",
      items: [
        ["10:00", "anchor", "Marina do Funchal, Pontoon C", "Meet the skippers on the pontoon, 15 minutes before."],
        ["10:20", "village", "Câmara de Lobos", "The fishing harbour Churchill painted, seen from the sea."],
        ["10:45", "drone", "Cabo Girão · drone up", "580 metres of cliff above you. Drinks and food come out while the drone flies."],
        ["11:15", "swim", "Fajã dos Padres · day trip", "Anchor under the terraces just west of the cliff. Swim and paddle."],
        ["12:30", "boat", "Back in Funchal", "Full speed home on the 2 h 30, or 13:00 on the 3 h."],
      ] }),
    faq(PAGES.find((x) => x.slug === "cabo-girao-boat-tour").faq),
    t.media,
    reserve(p, { ...EN_RESERVE, img: "g-cliffs", h2: "See Cabo Girão <em>from the sea</em>", p: `Check live dates and book your private boat in a couple of minutes. Your group only, from €${P.sunset2}.`, book: "/book", bookLabel: "Check dates &amp; book" }),
  ],
});

// 2. Fajã dos Padres --------------------------------------------------------
PAGES.push({
  slug: "faja-dos-padres-boat-trip", lang: "en",
  title: "Fajã dos Padres Boat Trip: Swim &amp; Paddle, Madeira | Chifbay",
  description: "Private boat trip to Fajã dos Padres from Funchal: swim and paddle at the cove with no road in. Day trip of 2h30 or 3h, up to 5 guests, from €500.",
  heroImg: "exp-coves-wide", heroAlt: "Aerial view of the Chifbay boat at anchor in clear water at Fajã dos Padres, a guest on a paddle board",
  badge: "Private day trip · Funchal to Fajã dos Padres",
  h1: "Fajã dos Padres<br><em>boat trip</em>",
  hsub: "A private boat trip to Fajã dos Padres, the strip of terraced coast under the cliffs with no road in. We anchor, you swim and take out the paddle boards. Day trip from Funchal, from €500 for the whole boat.",
  book: "/book-day", bookLabel: "Check dates &amp; book", waLabel: "Ask the skippers",
  meta: [["From", `<span class="now" data-cb-price="day-trip">€${P.day25}</span>`], ["Duration", "2h30 or 3h"], ["Guests", "Up to 5"], ["Departs", "10:00 · 14:00"]],
  trip: {
    name: "Private Fajã dos Padres boat trip with swim and paddle",
    description: "Private day trip by boat from Marina do Funchal to Fajã dos Padres: Câmara de Lobos, Cabo Girão, then anchor to swim and paddle under the cliffs, a second swim at Ribeira Brava. Drinks and food, Insta360 360° video, drone footage (weather allowing), camera photos. Whole boat for up to 5 guests.",
    stops: ["Marina do Funchal, Pontoon C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava"],
    offers: [["Day trip 2 h 30, Fajã dos Padres and Ribeira Brava", P.day25, "/book-day?v=ribeira-brava"], ["Day trip 3 h, on to Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol"]],
  },
  crumbs: EN_CRUMBS("Fajã dos Padres boat trip", "faja-dos-padres-boat-trip"),
  sbar: EN_SBAR("day-trip", `€${P.day25}`, "/book-day"),
  faq: {
    n: "05", label: "Good to know", h2: "Fajã dos Padres: questions",
    items: [
      ["How do you get to Fajã dos Padres?", "By boat or by a cable car down the cliff. There is no road. By boat it is 11.5 km west of Marina do Funchal, past Câmara de Lobos and Cabo Girão: we anchor there about 1 h 15 after leaving."],
      ["Can we swim at Fajã dos Padres?", "Yes, that is why we stop. We anchor off the terraces, you jump off the boat, swim, and take the paddle boards out. There is a second swim stop at Ribeira Brava before we turn for home."],
      ["Which trip stops at Fajã dos Padres?", `The <a href="hidden-coves-half-day">day trip</a>, at 10:00 or 14:00: 2 h 30 (€${P.day25}) or 3 h (€${P.day3}, on to Ponta do Sol). The 2 h 30 <a href="sunset-cruise">sunset cruise</a> passes it in the evening light but does not stop to swim.`],
      ["What is included?", "Drinks and food on board, paddle boards, the private boat for up to 5 guests and two local skippers. Every trip also includes an Insta360 360° video, drone footage from above (weather allowing) and high quality photos taken with a real camera."],
      ["Is the water warm enough?", "The sea off Madeira is warmest from late summer into autumn and coolest in late winter. We swim on the day trip all year when the sea allows; the skippers tell you on the day if it is too rough to anchor."],
      ["Can we cancel?", "Yes. Free cancellation up to 24 hours before departure. If the sea is too rough to go, we move your trip or refund it."],
    ],
  },
  sections: (p, t) => [
    ed(p, { n: "01", label: "The cove with no road", h2: "Swim where<br>the road never got",
      paras: [
        "Fajã dos Padres is a narrow shelf of land at the foot of the cliffs just west of Cabo Girão. Vines and fruit trees grow on its terraces, farmed for centuries, and the only ways in are a cable car down the rock face or a boat.",
        "That is what makes it the best swim stop on the south coast. We anchor off the stones, the water is clear, and the cliff goes straight up behind the boat. You jump in, swim, and the <strong>paddle boards</strong> come off the deck. Drinks and food are on board.",
      ],
      cta: ["#options", "See the two options"],
      img: "exp-coves", alt: "Boat trip to Fajã dos Padres: the Chifbay boat at anchor with guests swimming and paddle boarding", cap: "Fajã dos Padres · swim and paddle stop" }),
    opts({ n: "02", label: "Two options", h2: "Pick how far west",
      lead: "Both run at 10:00 or 14:00 and both stop at Fajã dos Padres. The 3 h simply goes further, to Ponta do Sol.",
      cards: [
        { dur: "2h30 · 10:00 → 12:30 or 14:00 → 16:30", h3: "Turns at Ribeira Brava", turn: "Câmara de Lobos · Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip/ribeira-brava", unit: "Flat price · whole boat · up to 5",
          li: ["Swim, jump in and paddle at Fajã dos Padres", "Cabo Girão from the water, with drone footage", "A second swim stop at Ribeira Brava", "Drinks and food aboard"],
          href: "/book-day?v=ribeira-brava", btn: "Book 2h30" },
        { dur: "3 hours · 10:00 → 13:00 or 14:00 → 17:00", h3: "Turns at Ponta do Sol", turn: "…plus Ponta do Sol · 30 more minutes", price: `€${P.day3}`, live: "day-trip/ponta-do-sol", unit: "Flat price · whole boat · up to 5",
          li: ["Everything in the 2h30", "On past Ribeira Brava to Ponta do Sol", "More time in the water at each stop", "Insta360 360° video, drone footage and camera photos, like every trip"],
          href: "/book-day?v=ponta-do-sol", btn: "Book 3h" },
      ] }),
    feat([
      ["wave", "Swim &amp; paddle", "Paddle boards aboard, and two swim stops: Fajã dos Padres and Ribeira Brava."],
      ["drink", "Drinks &amp; food aboard", "Served under Cabo Girão and at anchor. Included in the price."],
      ["drone", "Filmed from above", "Drone footage of your boat at anchor, weather allowing, plus a 360° video and camera photos."],
    ]),
    ed(p, { n: "03", label: "Just past Cabo Girão", h2: "On the way:<br>the big cliff", flip: true, top0: true,
      paras: [
        "Fajã dos Padres sits at 11.5 km by sea, so the trip there is part of the fun. You pass Câmara de Lobos at 6 km and stop under <a href=\"cabo-girao-boat-tour\">Cabo Girão</a> at 9 km, where the drone goes up.",
        "After the swim we carry on to <strong>Ribeira Brava</strong> for a second dip, and on the 3 h trip to Ponta do Sol. Then the throttle goes down for the run back to Funchal.",
      ],
      img: "gallery/g09", alt: "A guest swimming beside the Chifbay boat in clear water off Madeira", cap: "Back in the water at the second stop" }),
    t.route,
    timeline({ n: "04", label: "The trip, hour by hour", h2: "Your day on the water", lead: "Times for the 10:00 slot. The 14:00 slot runs the same, four hours later.",
      items: [
        ["10:00", "anchor", "Cast off from Marina do Funchal", "Meet the skippers on Pontoon C and head west along the waterfront."],
        ["10:20", "village", "Câmara de Lobos", "Painted fishing boats in the bay Churchill came to paint."],
        ["10:45", "drone", "Cabo Girão · drone up", "580 metres of cliff. Drinks and food come out while the drone flies."],
        ["11:15", "swim", "Fajã dos Padres · swim &amp; paddle", "Anchor under the terraces. Jump off the boat, swim, take the paddle boards out."],
        ["12:00", "swim", "Ribeira Brava · second swim", "Back in the water off the Ribeira Brava seafront."],
        ["12:30 / 13:00", "boat", "Full speed home", "Back on the pontoon in Funchal."],
      ] }),
    faq(PAGES.find((x) => x.slug === "faja-dos-padres-boat-trip").faq),
    t.media,
    reserve(p, { ...EN_RESERVE, img: "exp-coves-wide", h2: "Swim at <em>Fajã dos Padres</em>", p: `Check live dates and book the day trip in a couple of minutes. Your group only, from €${P.day25}.`, book: "/book-day", bookLabel: "Check dates &amp; book" }),
  ],
});

// 3. Boat rental with skipper ------------------------------------------------
PAGES.push({
  slug: "boat-rental-with-skipper-funchal", lang: "en",
  title: "Boat Rental with Skipper, Funchal · Private Charter | Chifbay",
  description: "Boat rental with skipper in Funchal: a private 2026 Karnic R8S, two licensed local skippers, up to 5 guests. Trips of 2h to 3h from €400, food and drinks.",
  heroImg: "boat-action", heroAlt: "The 2026 Karnic R8S that Chifbay charters with skipper from Funchal, at speed off Madeira",
  badge: "Private charter with skipper · Marina do Funchal",
  h1: "Boat rental<br>with <em>skipper</em>, Funchal",
  hsub: "Looking for a boat rental with skipper in Funchal? With us you charter the whole boat, a 2026 Karnic R8S, and two licensed local skippers drive it. There is no self drive. Up to 5 guests, from €400.",
  book: "/book", bookLabel: "Check dates &amp; book", waLabel: "Ask the skippers",
  meta: [["From", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["Boat", "2026 Karnic R8S"], ["Crew", "2 skippers"], ["Guests", "Up to 5"]],
  trip: {
    name: "Private boat charter with skipper from Funchal",
    description: "Private charter of a 2026 Karnic R8S (9 m, Mercury V8 300 hp) with two licensed local skippers from Marina do Funchal. Day trip with swim and paddle or sunset cruise along the south-west coast of Madeira. Food and drinks, Insta360 360° video, drone footage (weather allowing), camera photos. Up to 5 guests.",
    stops: ["Marina do Funchal, Pontoon C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava"],
    offers: [["Sunset 2 h to Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao"], ["Sunset 2 h 30 to Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava"], ["Day trip 2 h 30 to Ribeira Brava", P.day25, "/book-day?v=ribeira-brava"], ["Day trip 3 h to Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol"]],
  },
  crumbs: EN_CRUMBS("Boat rental with skipper", "boat-rental-with-skipper-funchal"),
  sbar: EN_SBAR("sunset", `€${P.sunset2}`, "/book"),
  faq: {
    n: "05", label: "Good to know", h2: "Renting a boat with skipper: questions",
    items: [
      ["Can I drive the boat myself?", "No. We do not rent boats without crew. Our two licensed skippers drive the boat on every trip, and you sit back, swim and enjoy the coast. Chifbay is a licensed maritime tourism operator, RNAAT 305/2026."],
      ["How long can we rent the boat for?", "We run set trips: the sunset cruise for 2 h or 2 h 30, and the day trip for 2 h 30 or 3 h at 10:00 or 14:00. For another date or time, message us on WhatsApp and we will tell you what is possible."],
      ["How much is a boat with skipper in Funchal?", `One flat price for the whole boat, up to 5 guests: €${P.sunset2} (sunset 2 h), €${P.sunset25} (sunset 2 h 30 or day trip 2 h 30) and €${P.day3} (day trip 3 h). Fuel, the skippers, drinks and food are included. Never per person.`],
      ["Is the boat shared with other people?", "Never. The boat, the crew and the trip are yours alone, from 1 to 5 guests."],
      ["What is on board?", "A 2026 Karnic R8S: 9 metres, Mercury V8 300 hp, cushioned seats, a swim platform and a bathroom. On the day trip there are paddle boards. Every trip includes drinks and food, an Insta360 360° video, drone footage (weather allowing) and camera photos."],
      ["Where do we meet?", "Marina do Funchal, Pontoon C, next to the statue. Arrive 15 minutes before departure. Free cancellation up to 24 hours before."],
    ],
  },
  sections: (p, t) => [
    ed(p, { n: "01", label: "What you get", h2: "A private boat,<br>with the crew included",
      paras: [
        "Many people search for a boat to rent in Funchal. In Madeira that almost always means a boat with a skipper, and with us it means two. You book the whole boat for your group, and two licensed local skippers take you along the coast while you swim, eat and take photos.",
        "The boat is a <strong>2026 Karnic R8S</strong>: 9 metres, a Mercury V8 300 hp engine, cushioned seating, a swim platform and a bathroom on board. It takes up to 5 guests, so there is room to move and lie in the sun.",
      ],
      cta: ["#options", "See the trips"],
      img: "cliffs-deck", alt: "Two Chifbay skippers at the helm of the rented boat under the cliffs of Madeira", cap: "Two skippers on every trip" }),
    opts({ n: "02", label: "The trips", h2: "Two ways to use the boat",
      lead: "Same boat, same crew. Pick a day trip to swim or a sunset cruise for the evening light.",
      cards: [
        { dur: "10:00 or 14:00 · 2 h 30 or 3 h", h3: "Day trip with a swim", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "From · whole boat · up to 5",
          li: ["Swim and paddle at Fajã dos Padres", "Drone footage at Cabo Girão, weather allowing", "Drinks and food aboard", `3 h option on to Ponta do Sol (€${P.day3})`],
          href: "/book-day", btn: "Book the day trip", more: ["hidden-coves-half-day", "Read about the day trip"] },
        { dur: "Evening · 2 h or 2 h 30", h3: "Sunset cruise", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava", price: `€${P.sunset2}`, live: "sunset", unit: "From · whole boat · up to 5",
          li: ["Leaves 1 h 15 before sunset", "Drinks, food and complimentary Portuguese wine on deck", "Cabo Girão in the evening light", `2 h 30 option on to Ribeira Brava (€${P.sunset25})`],
          href: "/book-sunset", btn: "Book the sunset cruise", more: ["sunset-cruise", "Read about the sunset cruise"] },
      ] }),
    feat([
      ["crew", "Two licensed skippers", "Local, licensed, and on board every trip. RNAAT 305/2026."],
      ["boat", "2026 Karnic R8S", "9 m, Mercury V8 300 hp, swim platform, bathroom on board."],
      ["drink", "All in the price", "Fuel, crew, drinks and food. One price for the boat, not per person."],
    ]),
    ed(p, { n: "03", label: "Why no self drive", h2: "Honest answer:<br>we drive, you enjoy", flip: true, top0: true,
      paras: [
        "Madeira's south coast is open Atlantic. The swell changes during the day, and the best spots, like the anchorage at <a href=\"faja-dos-padres-boat-trip\">Fajã dos Padres</a> or the water under <a href=\"cabo-girao-boat-tour\">Cabo Girão</a>, need local knowledge. That is why we only offer the boat with our crew.",
        "It also means nobody in your group has to stay sober or watch the sea. The skippers handle the boat, the drone and the photos, and you get the whole trip on film afterwards.",
      ],
      img: "deck", alt: "The deck of the Chifbay boat with cushioned seating and swim platform", cap: "Cushioned seating and a swim platform" }),
    faq(PAGES.find((x) => x.slug === "boat-rental-with-skipper-funchal").faq),
    t.media,
    reserve(p, { ...EN_RESERVE, img: "boat-action", h2: "Your boat, <em>our skippers</em>", p: `Check live dates and book the whole boat in a couple of minutes. Up to 5 guests, from €${P.sunset2}.`, book: "/book", bookLabel: "Check dates &amp; book" }),
  ],
});

// 4. Comparison --------------------------------------------------------------
const CMP_CSS = ".cmp-wrap{overflow-x:auto;margin:28px 0 8px;border:1px solid var(--hair);border-radius:14px}.cmp-t{width:100%;min-width:720px;border-collapse:collapse;font-size:.92rem;line-height:1.5}.cmp-t th,.cmp-t td{padding:13px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--hair)}.cmp-t thead th{font-family:'Space Mono',monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:400;border-bottom:1px solid var(--hair-strong)}.cmp-t tbody tr:last-child td{border-bottom:none}.cmp-t td:first-child{font-weight:600;white-space:nowrap}.cmp-note{font-size:.85rem;color:var(--muted);max-width:70ch}.cmp-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:32px}.cmp-card{border:1px solid var(--hair);border-radius:14px;padding:24px 26px}.cmp-card h3{font-family:var(--ff-serif,serif);font-size:1.45rem;margin:0 0 8px}.cmp-card .k{font-family:'Space Mono',monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.cmp-card p{margin:.5em 0 0}.cmp-list{max-width:68ch;padding-left:1.1em}.cmp-list li{margin:.45em 0}@media(max-width:820px){.cmp-cards{grid-template-columns:1fr}}";
const prose = (n, label, h2, html) => `<section class="chapter" style="padding-top:0">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">${n}</span><span class="cl">${label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:12px">${h2}</h2>
${html}
  </div>
</section>`;
PAGES.push({
  slug: "best-boat-trips-madeira", lang: "en", css: CMP_CSS,
  title: "Best Boat Trips in Madeira (2026): Compared | Chifbay",
  description: "Best boat trips in Madeira for 2026: private boat, shared catamaran, sailing and whale watching compared. Prices, who each suits, real operators.",
  heroImg: "hero", heroAlt: "A private boat off the south coast of Madeira in the evening",
  badge: "Guide · updated 9 October 2026",
  h1: "Best boat trips<br>in <em>Madeira</em> (2026)", h1Plain: "Best boat trips in Madeira (2026): private, shared, sailing and whale watching compared",
  hsub: "Private, shared, sailing and whale watching compared. The best boat trips in Madeira, what they cost and who each one suits. Written by Chifbay, a private boat company in Funchal, so we say where we fit and where another trip is the better pick.",
  book: "#compare", bookLabel: "See the comparison", waLabel: "Ask us a question",
  meta: [["Shared trip", "€59 per person*"], ["Private boat", "€537 per boat*"], ["Operators", "6 compared"], ["Prices read", "4 Oct 2026"]],
  article: { published: "2026-10-09" },
  crumbs: [["Home", "/"], ["Journal", "/blog"], ["Best boat trips in Madeira", "/best-boat-trips-madeira"]],
  sbar: { aria: "Private boat trips", k: "Private boat", v: `€${P.sunset2}`, live: "sunset", href: "/book", label: "Book Chifbay" },
  faq: {
    n: "06", label: "Questions", h2: "Boat trips in Madeira: questions",
    items: [
      ["What is the best boat trip in Madeira?", "It depends on who is going. For whales and dolphins, a specialist whale watching trip. For the lowest price per person, a shared catamaran. For a couple, a family or a small group who want to swim, take their time and have the boat to themselves, a private boat. For wind and quiet, a sailing trip."],
      ["How much does a boat trip in Madeira cost?", `When we counted every GetYourGuide boat listing for Madeira on 11 August 2026, the median shared trip was €59 per person (34 listings) and the median private boat was €537 for the whole boat (24 listings). Chifbay charges €${P.sunset2} to €${P.day3} for the whole boat, up to 5 guests.`],
      ["Is a private boat cheaper than a shared trip for a group?", `Usually not. For two people a €${P.sunset2} private boat is €200 each against about €59 each on a shared trip. The gap closes as the group grows: €80 each for five. You pay for having the boat, the route and the time to yourselves.`],
      ["Are dolphins and whales guaranteed?", "No trip can promise wild animals. Specialist whale watching operators go out to look for them, and that is their main focus. On a private coastal trip like ours, dolphins are a bonus when they show up, never a promise."],
      ["Where do boat trips leave from in Madeira?", "Most leave from Marina do Funchal. Some whale watching companies work from other towns, for example Lobosonda in Calheta, on the west of the south coast."],
      ["Which boat trip goes to Cabo Girão and Fajã dos Padres?", `Several trips pass Cabo Girão. Chifbay goes to <a href="cabo-girao-boat-tour">Cabo Girão</a> on every trip and stops to swim at <a href="faja-dos-padres-boat-trip">Fajã dos Padres</a> on the day trip.`],
    ],
  },
  sections: (p) => [
    prose("01", "Four kinds of trip", "Which boat trip suits you?", `    <p class="reveal d1" style="max-width:68ch">Madeira has four kinds of boat trip, and they are sold side by side on the same booking pages. The first thing to check is the unit: a shared trip is priced per person, a private boat is priced for the whole boat.</p>
    <div class="cmp-cards">
      <div class="cmp-card reveal"><div class="k">Per person · from about €35 to €60</div><h3>Shared catamaran or boat</h3><p>A big boat on a fixed route and timetable, often with dozens of other guests. The cheapest way onto the water, and the right pick for one or two people on a budget.</p></div>
      <div class="cmp-card reveal d1"><div class="k">Per person · from about €45 to €70</div><h3>Whale and dolphin watching</h3><p>Trips built around finding marine life, by catamaran, traditional boat or fast RIB. Pick this if the animals are the reason you are going.</p></div>
      <div class="cmp-card reveal"><div class="k">Per person or per boat</div><h3>Sailing</h3><p>Slower and quieter, under sail when the wind allows. Shared sailing trips and private sailing boats both exist; private sunset sails start around €500 per boat.</p></div>
      <div class="cmp-card reveal d1"><div class="k">Per boat · median €537</div><h3>Private boat</h3><p>The whole boat for your group, with a skipper. You choose the pace, stay longer to swim, and nobody else is aboard. Prices run from about €150 to well over €1,000 per boat.</p></div>
    </div>
    <p class="cmp-note reveal">* Medians from our own count of 58 GetYourGuide boat listings for Madeira on 11 August 2026: shared €59 per person (34 listings), private €537 per boat (24 listings). Method and full data: <a href="/posts/madeira-boat-tour-prices-2026">Madeira boat tour prices 2026</a>.</p>`),
    prose("02", "Operators compared", "Six boat operators, side by side", `    <p class="reveal d1" style="max-width:68ch" id="compare">Facts below were read on the operators' own websites or on GetYourGuide on 4 October 2026. GetYourGuide shows US dollar prices to US visitors, so those are in US$. We left out star ratings: counts change every week and are not comparable across sites. "Visit Madeira list" means the operator appears on the official tourism board's boat trips page.</p>
    <div class="cmp-wrap reveal">
      <table class="cmp-t">
        <thead><tr><th>Operator</th><th>Kind of trip</th><th>Price read on 4 Oct 2026</th><th>Good to know</th><th>Visit Madeira list</th></tr></thead>
        <tbody>
          <tr><td>Chifbay</td><td>Private motor boat, Funchal</td><td>€${P.sunset2} to €${P.day3} per boat, up to 5 guests</td><td>2026 Karnic R8S, two skippers, food and drinks, swim stop on the day trip, 360° video, drone and camera photos included</td><td>No</td></tr>
          <tr><td>Cristal Sea Madeira</td><td>Private boats, Funchal</td><td>Private boat 2 h 30 from €320 per boat; private sunset 2 h 30 from €340; bigger boats from €500</td><td>Up to 10 to 12 guests; paddle boards and snorkel gear included; books on its own site; licence RNAAT 375/2022</td><td>Yes</td></tr>
          <tr><td>Ventura do Mar (Ventura Nature Emotions)</td><td>Shared sea trips, Funchal</td><td>See their site</td><td>Running since 2001; books online</td><td>Yes</td></tr>
          <tr><td>VMT Madeira</td><td>Shared catamaran, Funchal</td><td>Whale and dolphin trip 3 h about US$45 to 48 per person; sunset catamaran US$45; Desertas day US$101 (GetYourGuide)</td><td>Books online; site in Portuguese and English</td><td>Yes</td></tr>
          <tr><td>Lobosonda</td><td>Whale and dolphin watching, Calheta</td><td>Traditional boat from €51.83 per person; RIB 2 h from €66.63 per person</td><td>Running since 2003; site in Portuguese, German and English; based in Calheta, not Funchal</td><td>Yes</td></tr>
          <tr><td>Bonita da Madeira</td><td>Shared boat trips, Funchal</td><td>See their site</td><td>Listed by the tourism board among Funchal boat operators</td><td>Yes</td></tr>
        </tbody>
      </table>
    </div>
    <p class="cmp-note reveal">Prices change. Check the operator before you book. If you run one of these companies and a fact here is out of date, write to hello@chifbay.com and we will correct it.</p>`),
    prose("03", "Who each one suits", "Pick by who is going", `    <ul class="cmp-list reveal d1">
      <li><strong>One or two people on a budget:</strong> a shared catamaran or a shared whale watching trip. A private boat makes little sense for one person.</li>
      <li><strong>You came for whales and dolphins:</strong> a specialist whale watching operator such as VMT Madeira or Lobosonda. That is their whole trip.</li>
      <li><strong>A couple celebrating, or a proposal:</strong> a private sunset trip. Nobody else aboard, and the timing follows the sun.</li>
      <li><strong>A family or a group of 4 or 5 who want to swim:</strong> a private day trip. The boat waits while you swim, and the price per person drops fast with a full boat.</li>
      <li><strong>A bigger group, 6 to 12 people:</strong> a private operator with a larger boat, such as Cristal Sea Madeira. Chifbay takes 5 guests at most.</li>
      <li><strong>You want wind and quiet:</strong> a sailing trip.</li>
    </ul>`),
    prose("04", "Why a private boat", "When a private boat is worth it", `    <p class="reveal d1" style="max-width:68ch">A private boat costs more than a shared seat. What you buy is control: you choose when to stop, how long to swim, whether to go fast or slow, and nobody else is on board. On the south-west coast, that means time at the base of <a href="cabo-girao-boat-tour">Cabo Girão</a> and a swim at <a href="faja-dos-padres-boat-trip">Fajã dos Padres</a>, the cove with no road in, without a timetable.</p>
    <p class="reveal d2" style="max-width:68ch">At Chifbay the whole boat is €${P.sunset2} for the 2 h <a href="sunset-cruise">sunset cruise</a> and €${P.day25} or €${P.day3} for the <a href="hidden-coves-half-day">day trip</a>, for up to 5 guests, with two local skippers, food and drinks, a 360° video, drone footage and camera photos included. More detail on our <a href="private-boat-tour-madeira">private boat tour</a> page and in <a href="private-boat-vs-catamaran-madeira">private boat or catamaran?</a></p>`),
    prose("05", "Before you book", "Four questions to ask any operator", `    <ol class="cmp-list reveal d1">
      <li><strong>Is the price per person or for the whole boat?</strong> Both appear in the same search results.</li>
      <li><strong>How many other people will be aboard?</strong> A shared trip can mean 10 or 100.</li>
      <li><strong>What is not in the price?</strong> Drinks, food, photos and hotel pickup are often extras.</li>
      <li><strong>Where does it actually go, and for how long?</strong> Two trips of the same length can cover very different coast.</li>
    </ol>`),
    faq(PAGES.find((x) => x.slug === "best-boat-trips-madeira").faq),
    reserve(p, { lbl: "Chifbay · Marina do Funchal", img: "charter", h2: "Want the boat <em>to yourselves?</em>", p: `Private boat trips from Funchal for up to 5 guests, from €${P.sunset2} for the whole boat.`, book: "/book", bookLabel: "Check dates &amp; book", wa: "Message the skippers", call: "Or call directly" }),
  ],
});

// 5. German private boat tour ------------------------------------------------
const PRIV_ALTS = [["en", "private-boat-tour-madeira"], ["fr", "fr/private-boat-tour-madeira"], ["de", "de/private-boat-tour-madeira"]];
PAGES.push({
  slug: "de/private-boat-tour-madeira", lang: "de", alternates: PRIV_ALTS,
  title: "Private Bootstour Madeira: Privatboot ab Funchal | Chifbay",
  description: "Private Bootstour auf Madeira ab Funchal: das ganze Boot für bis zu 5 Gäste, zwei Skipper, Baden an der Fajã dos Padres, Sonnenuntergang. Ab 400 €.",
  heroImg: "hero", heroAlt: "Private Bootstour auf Madeira: das Chifbay Boot vor der Südküste bei Funchal",
  badge: "Privatboot · Funchal, Madeira",
  h1: "Private Bootstour<br><em>Madeira</em>",
  hsub: "Eine private Bootstour auf Madeira, nur für Ihre Gruppe: das ganze Boot ab der Marina do Funchal, zwei Skipper aus Madeira, bis zu 5 Gäste. Tagestour mit Baden oder Fahrt zum Sonnenuntergang, ab 400 € pro Boot.",
  book: "/book?lang=de", bookLabel: "Termine prüfen &amp; buchen", waLabel: "Die Skipper fragen",
  meta: [["Ab", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["Gäste", "Bis zu 5"], ["Boot", "Karnic R8S 2026"], ["Start", "Marina do Funchal"]],
  trip: {
    name: "Private Bootstour auf Madeira ab Funchal",
    description: "Private Bootstour ab der Marina do Funchal auf einer Karnic R8S von 2026 mit zwei Skippern, für bis zu 5 Gäste: Tagestour mit Baden und Paddeln an der Fajã dos Padres oder Fahrt zum Sonnenuntergang nach Cabo Girão. Essen und Getränke, Insta360-360°-Video, Drohnenaufnahmen (wenn das Wetter es erlaubt) und Kamerafotos inklusive.",
    stops: ["Marina do Funchal, Steg C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava"],
    touristType: ["Paare", "Familien", "Kleine Gruppen"],
    offers: [["Sonnenuntergang 2 Std., Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao&lang=de"], ["Sonnenuntergang 2,5 Std., Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava&lang=de"], ["Tagestour 2,5 Std., Ribeira Brava", P.day25, "/book-day?v=ribeira-brava&lang=de"], ["Tagestour 3 Std., Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol&lang=de"]],
  },
  crumbs: [["Startseite", "/de/"], ["Erlebnisse", "/de/experiences"], ["Private Bootstour Madeira", "/de/private-boat-tour-madeira"]],
  sbar: { aria: "Datum wählen", k: "Ab", v: `€${P.sunset2}`, live: "sunset", href: "/book?lang=de", label: "Jetzt buchen" },
  faq: {
    n: "04", label: "Gut zu wissen", h2: "Fragen zur privaten Bootstour",
    items: [
      ["Was kostet eine private Bootstour auf Madeira?", `Ein fester Preis für das ganze Boot, bis zu 5 Gäste: ${P.sunset2} € für 2 Std. zum Sonnenuntergang, ${P.sunset25} € für 2,5 Std. (Sonnenuntergang oder Tagestour) und ${P.day3} € für die Tagestour mit 3 Std. Nie pro Person.`],
      ["Ist das Boot wirklich nur für uns?", "Ja. Das Boot, die zwei Skipper und die Route gehören nur Ihrer Gruppe, von 1 bis 5 Gästen. Wir mischen nie Gruppen."],
      ["Was ist inklusive?", "Essen und Getränke an Bord, auf beiden Touren. Auf jeder Fahrt außerdem ein Insta360-360°-Video, Drohnenaufnahmen von oben (wenn das Wetter es erlaubt) und hochwertige Fotos mit einer echten Kamera. Paddleboards gibt es auf der Tagestour."],
      ["Wann fahren die Touren?", "Die Tagestour startet um 10:00 oder 14:00 Uhr. Die Fahrt zum Sonnenuntergang startet 1 Std. 15 Min. vor Sonnenuntergang, damit das Licht das ganze Jahr passt. Der Buchungskalender zeigt die genaue Zeit für Ihr Datum."],
      ["Wo ist der Treffpunkt?", "Marina do Funchal, Steg C, neben der Statue. Bitte 15 Minuten vor der Abfahrt da sein."],
      ["Kann ich stornieren?", "Ja, kostenlos bis 24 Stunden vor der Abfahrt."],
    ],
  },
  sections: (p, t) => [
    ed(p, { n: "01", label: "Ihr eigenes Boot", h2: "Kein Ausflugsschiff,<br>Ihr Boot", paras: [
      "Auf großen Ausflugsschiffen sind Sie oft mit Dutzenden Fremden an Bord. Bei Chifbay buchen Sie das ganze Boot: eine <strong>Karnic R8S von 2026</strong>, 9 Meter, Mercury V8 mit 300 PS, Badeplattform und Bad an Bord. Zwei Skipper aus Madeira fahren, Sie genießen die Küste.",
      "Ab der <strong>Marina do Funchal</strong> geht es nach Westen: vorbei an Câmara de Lobos, unter die 580 Meter hohe Steilküste von Cabo Girão, wo die Drohne aufsteigt, und weiter zur Bucht <strong>Fajã dos Padres</strong>, die nur per Boot oder Seilbahn erreichbar ist.",
    ], cta: ["#options", "Die zwei Touren"], img: "g-cliffs", alt: "Private Bootstour unter den Klippen von Cabo Girão, Madeira", cap: "Cabo Girão vom Wasser aus" }),
    opts({ n: "02", label: "Zwei Touren", h2: "Tagsüber oder zum Sonnenuntergang",
      lead: "Gleiches Boot, gleiche Crew. Wählen Sie Baden am Tag oder das Abendlicht.",
      cards: [
        { dur: "10:00 oder 14:00 · 2,5 oder 3 Std.", h3: "Die Tagestour", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "Ab · ganzes Boot · bis zu 5",
          li: ["Baden und Paddeln an der Fajã dos Padres", "Zweiter Badestopp in Ribeira Brava", "Essen und Getränke an Bord", `3 Std. bis Ponta do Sol (${P.day3} €)`],
          href: "/book-day?lang=de", btn: "Tagestour buchen", more: ["hidden-coves-half-day", "Mehr zur Tagestour"] },
        { dur: "Abends · 2 oder 2,5 Std.", h3: "Zum Sonnenuntergang", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava", price: `€${P.sunset2}`, live: "sunset", unit: "Ab · ganzes Boot · bis zu 5",
          li: ["Abfahrt 1 Std. 15 Min. vor Sonnenuntergang", "Essen, Getränke und portugiesischer Wein inklusive", "Drohnenaufnahmen an Cabo Girão", `2,5 Std. bis Ribeira Brava (${P.sunset25} €)`],
          href: "/book-sunset?lang=de", btn: "Sonnenuntergang buchen", more: ["sunset-cruise", "Mehr zur Abendfahrt"] },
      ] }),
    feat([
      ["crew", "Zwei Skipper", "Lizenziert und aus Madeira, auf jeder Fahrt an Bord. RNAAT 305/2026."],
      ["drink", "Essen &amp; Getränke", "Auf beiden Touren im Preis inklusive. Kein Aufpreis."],
      ["drone", "Alles auf Video", "360°-Video, Drohne (wenn das Wetter es erlaubt) und Kamerafotos, danach zugeschickt."],
    ]),
    ed(p, { n: "03", label: "Für wen", h2: "Paare, Familien,<br>kleine Gruppen", flip: true, top0: true, paras: [
      "Ein Privatboot lohnt sich besonders für Paare mit einem Anlass, für Familien und für Gruppen von 4 oder 5 Personen. Der Preis gilt für das ganze Boot: zu fünft sind es 80 € pro Person für die Abendfahrt.",
      "Sie bestimmen das Tempo: länger baden, langsamer an den Klippen, schneller auf dem Heimweg. Delfine sind ein Geschenk, wenn sie auftauchen, aber nie versprochen.",
    ], img: "charter", alt: "Ein Paar auf dem Bug des privaten Chifbay Boots beim Sonnenuntergang vor Funchal", cap: "Nur Ihre Gruppe an Bord" }),
    faq(PAGES.find((x) => x.slug === "de/private-boat-tour-madeira").faq),
    t.media,
    reserve(p, { img: "hero", lbl: "Marina do Funchal · Steg C", h2: "Ihr Boot. <em>Ihr Madeira.</em>", p: `Freie Termine prüfen und das ganze Boot in wenigen Minuten buchen. Nur Ihre Gruppe, ab ${P.sunset2} €.`, book: "/book?lang=de", bookLabel: "Termine prüfen &amp; buchen", wa: "WhatsApp an die Skipper", call: "Oder direkt anrufen" }),
  ],
});

// 6. French private boat tour ------------------------------------------------
PAGES.push({
  slug: "fr/private-boat-tour-madeira", lang: "fr", alternates: PRIV_ALTS,
  title: "Excursion Bateau Privé Madère depuis Funchal | Chifbay",
  description: "Excursion en bateau privé à Madère depuis Funchal : le bateau entier pour 5 personnes max., deux skippers, baignade, coucher de soleil. Dès 400 €.",
  heroImg: "hero", heroAlt: "Excursion en bateau privé à Madère : le bateau Chifbay au large de Funchal",
  badge: "Bateau privé · Funchal, Madère",
  h1: "Excursion en bateau privé<br>à <em>Madère</em>",
  hsub: "Une excursion en bateau privé à Madère, rien que pour votre groupe : tout le bateau depuis la Marina do Funchal, deux skippers madériens, jusqu'à 5 personnes. Sortie de jour avec baignade ou coucher de soleil, dès 400 € le bateau.",
  book: "/book?lang=fr", bookLabel: "Voir les dates &amp; réserver", waLabel: "Écrire aux skippers",
  meta: [["Dès", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["Personnes", "Jusqu'à 5"], ["Bateau", "Karnic R8S 2026"], ["Départ", "Marina do Funchal"]],
  trip: {
    name: "Excursion en bateau privé à Madère depuis Funchal",
    description: "Sortie en bateau privé depuis la Marina do Funchal sur un Karnic R8S de 2026 avec deux skippers, jusqu'à 5 personnes : sortie de jour avec baignade et paddle à Fajã dos Padres, ou coucher de soleil jusqu'à Cabo Girão. Repas et boissons, vidéo 360° Insta360, images de drone (si la météo le permet) et photos à l'appareil inclus.",
    stops: ["Marina do Funchal, ponton C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava"],
    touristType: ["Couples", "Familles", "Petits groupes"],
    offers: [["Coucher de soleil 2 h, Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao&lang=fr"], ["Coucher de soleil 2 h 30, Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava&lang=fr"], ["Sortie de jour 2 h 30, Ribeira Brava", P.day25, "/book-day?v=ribeira-brava&lang=fr"], ["Sortie de jour 3 h, Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol&lang=fr"]],
  },
  crumbs: [["Accueil", "/fr/"], ["Expériences", "/fr/experiences"], ["Excursion en bateau privé", "/fr/private-boat-tour-madeira"]],
  sbar: { aria: "Choisir une date", k: "Dès", v: `€${P.sunset2}`, live: "sunset", href: "/book?lang=fr", label: "Réserver" },
  faq: {
    n: "04", label: "Bon à savoir", h2: "Vos questions sur le bateau privé",
    items: [
      ["Combien coûte une excursion en bateau privé à Madère ?", `Un prix fixe pour tout le bateau, jusqu'à 5 personnes : ${P.sunset2} € pour le coucher de soleil de 2 h, ${P.sunset25} € pour 2 h 30 (coucher de soleil ou sortie de jour) et ${P.day3} € pour la sortie de jour de 3 h. Jamais par personne.`],
      ["Le bateau est-il vraiment privé ?", "Oui. Le bateau, les deux skippers et le parcours sont à votre groupe seul, de 1 à 5 personnes. Nous ne mélangeons jamais les groupes."],
      ["Qu'est-ce qui est inclus ?", "Repas et boissons à bord, sur les deux sorties. Sur chaque sortie aussi : une vidéo 360° Insta360, des images de drone vues du ciel (si la météo le permet) et des photos de qualité prises avec un vrai appareil photo. Les paddles sont sur la sortie de jour."],
      ["À quelle heure partent les sorties ?", "La sortie de jour part à 10:00 ou 14:00. Le coucher de soleil part 1 h 15 avant le coucher du soleil, pour que la lumière soit belle toute l'année. Le calendrier de réservation affiche l'heure exacte de votre date."],
      ["Où est le point de rendez-vous ?", "Marina do Funchal, ponton C, à côté de la statue. Arrivez 15 minutes avant le départ."],
      ["Puis-je annuler ?", "Oui, gratuitement jusqu'à 24 heures avant le départ."],
    ],
  },
  sections: (p, t) => [
    ed(p, { n: "01", label: "Votre bateau", h2: "Pas un catamaran bondé,<br>votre bateau", paras: [
      "Sur les grands catamarans, vous partagez le pont avec des dizaines d'inconnus. Avec Chifbay, vous réservez tout le bateau : un <strong>Karnic R8S de 2026</strong>, 9 mètres, moteur Mercury V8 de 300 ch, plateforme de bain et toilettes à bord. Deux skippers madériens pilotent, vous profitez de la côte.",
      "Depuis la <strong>Marina do Funchal</strong>, cap à l'ouest : Câmara de Lobos, puis le pied de la falaise de Cabo Girão, haute de 580 mètres, où le drone décolle, et la crique de <strong>Fajã dos Padres</strong>, accessible seulement en bateau ou en téléphérique.",
    ], cta: ["#options", "Les deux sorties"], img: "g-cliffs", alt: "Excursion en bateau privé sous la falaise de Cabo Girão, Madère", cap: "Cabo Girão vu de la mer" }),
    opts({ n: "02", label: "Deux sorties", h2: "De jour ou au coucher du soleil",
      lead: "Même bateau, même équipage. Choisissez la baignade le jour ou la lumière du soir.",
      cards: [
        { dur: "10:00 ou 14:00 · 2 h 30 ou 3 h", h3: "La sortie de jour", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "Dès · tout le bateau · jusqu'à 5",
          li: ["Baignade et paddle à Fajã dos Padres", "Deuxième baignade à Ribeira Brava", "Repas et boissons à bord", `3 h jusqu'à Ponta do Sol (${P.day3} €)`],
          href: "/book-day?lang=fr", btn: "Réserver la sortie de jour", more: ["hidden-coves-half-day", "En savoir plus sur la sortie de jour"] },
        { dur: "En soirée · 2 h ou 2 h 30", h3: "Au coucher du soleil", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava", price: `€${P.sunset2}`, live: "sunset", unit: "Dès · tout le bateau · jusqu'à 5",
          li: ["Départ 1 h 15 avant le coucher du soleil", "Repas, boissons et vin portugais offert", "Images de drone à Cabo Girão", `2 h 30 jusqu'à Ribeira Brava (${P.sunset25} €)`],
          href: "/book-sunset?lang=fr", btn: "Réserver le coucher de soleil", more: ["sunset-cruise", "En savoir plus sur le coucher de soleil"] },
      ] }),
    feat([
      ["crew", "Deux skippers", "Diplômés et madériens, à bord à chaque sortie. RNAAT 305/2026."],
      ["drink", "Repas &amp; boissons", "Inclus sur les deux sorties. Rien à payer en plus."],
      ["drone", "Tout en images", "Vidéo 360°, drone (si la météo le permet) et photos à l'appareil, envoyés après."],
    ]),
    ed(p, { n: "03", label: "Pour qui", h2: "Couples, familles,<br>petits groupes", flip: true, top0: true, paras: [
      "Un bateau privé vaut surtout le coup pour un couple qui fête quelque chose, une famille ou un groupe de 4 ou 5. Le prix est celui du bateau : à cinq, le coucher de soleil revient à 80 € par personne.",
      "Vous choisissez le rythme : plus de temps dans l'eau, plus lentement sous les falaises, plus vite au retour. Les dauphins sont un cadeau quand ils passent, jamais une promesse.",
    ], img: "charter", alt: "Un couple à l'avant du bateau privé Chifbay au coucher du soleil devant Funchal", cap: "Votre groupe seul à bord" }),
    faq(PAGES.find((x) => x.slug === "fr/private-boat-tour-madeira").faq),
    t.media,
    reserve(p, { img: "hero", lbl: "Marina do Funchal · Ponton C", h2: "Votre bateau. <em>Votre Madère.</em>", p: `Voyez les dates libres et réservez tout le bateau en quelques minutes. Votre groupe seul, dès ${P.sunset2} €.`, book: "/book?lang=fr", bookLabel: "Voir les dates &amp; réserver", wa: "WhatsApp aux skippers", call: "Ou appelez directement" }),
  ],
});

// ---------------------------------------------------------------- write
let changed = 0;
for (const c of PAGES) {
  // own text only: the borrowed blocks keep whatever they already say
  const own = JSON.stringify({ ...c, sections: undefined }) + c.sections.toString();
  if (/[–—]/.test(own)) throw new Error(`${c.slug}: en or em dash in new text`);
  const html = render(c);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  const file = path.join(ROOT, `${c.slug}.html`);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (before === html) continue;
  changed++;
  console.log(`${before ? "update" : "new"}: ${c.slug}.html`);
  if (WRITE) fs.writeFileSync(file, html);
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s) changed of ${PAGES.length}.`);
