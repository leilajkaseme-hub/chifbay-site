// nye-2026.mjs: the New Year's Eve fireworks night, 31 December 2026.
// One boat, one group, one night: 22:00 to 01:00 from Marina do Funchal,
// 3,000 EUR for the whole boat, up to 5 guests, everything included.
//
// Read by build-seo-pages.mjs, which owns the page shell (menu, footer, head).
// The PRICE is not decided here: it lives in the booking store as the quote
// "nye-2026" (booking-api, `kind: "full"`), and the checkout charges what the
// quote says. The figure below is only the text shown on the page; keep the
// two equal (the quote is checked against it by the page script on load).
//
// To change the night: edit the quote in KV and the text here, then run
//   node scripts/build-seo-pages.mjs --only nye --write

import { I18N } from "./nye-2026-i18n.mjs";

export const NYE = {
  quote: "nye-2026",
  date: "2026-12-31",
  start: "22:00",
  end: "01:00",
  meet: "21:45",
  amount: 300000,          // cents, must equal the quote
  guests: 5,
  slug: "new-years-eve-fireworks-boat-madeira",
};

const LANGS = ["en", "fr", "de", "pt", "es", "it"];
const slugFor = (l) => (l === "en" ? NYE.slug : `${l}/${NYE.slug}`);
const ALTS = LANGS.map((l) => [l, slugFor(l)]);

// ---------------------------------------------------------------- text
// Facts only. Inclusions come from Theo's brief of 17 Oct 2026: food, drinks,
// local drinks, Insta360, drone, "everything". The drone flies before the
// show only: no drone near fireworks or over the crowd.
const T = {};

T.en = {
  price: "€3,000",
  title: "New Year's Eve Fireworks Boat Trip in Funchal, Madeira | Chifbay",
  description: "Watch the Madeira New Year fireworks from the sea: private boat on 31 Dec 2026, 22:00 to 01:00, Madeiran dinner, Champagne, 360° video. Up to 5 guests.",
  heroAlt: "New Year's Eve fireworks over Funchal bay seen from a private boat, Madeira",
  badge: "One night only · 31 December 2026",
  h1: "New Year's Eve<br><em>fireworks by boat</em>",
  hsub: "Watch the Madeira New Year fireworks from the middle of Funchal bay, on a private boat for your group only. Three hours on the water, a Madeiran dinner on deck, Champagne at midnight and the whole night filmed in 360°.",
  bookLabel: "Book the night", waLabel: "Ask the skippers",
  meta: [["Whole boat", "€3,000"], ["Date", "31 Dec 2026"], ["On the water", "22:00 to 01:00"], ["Guests", "Up to 5"]],
  crumbs: [["Home", "/"], ["Experiences", "/experiences"], ["New Year's Eve fireworks boat", `/${slugFor("en")}`]],
  sbar: { aria: "Book New Year's Eve", k: "31 Dec · whole boat", label: "Book the night" },
  event: {
    name: "New Year's Eve Fireworks Boat Trip, Funchal 2026",
    description: "Private boat on Funchal bay for the Madeira New Year fireworks, 31 December 2026, 22:00 to 01:00. Whole boat for up to 5 guests, two skippers, Madeiran dinner, Champagne for midnight, poncha and Madeira wine, Insta360 360° video, drone shots before the show and camera photos.",
  },
  intro: {
    label: "Why from the water", h2: "The whole bay lights up.<br>You sit in the middle of it",
    paras: [
      "At midnight on 31 December, Funchal fires its New Year fireworks from points all around the bay at once. The city is built like an amphitheatre on the hills, so the show makes a full circle of light. It was once named the largest fireworks display in the world by Guinness World Records, and the island still treats the night as its biggest party of the year.",
      "On land, the seafront is packed from early evening and the streets close. From the boat you see the whole circle at once, with nobody in front of you, the colours doubled on the water and the ships in the harbour sounding their horns at midnight. Just your group, two skippers and a table full of Madeiran food and drink.",
    ],
    cap: "Funchal bay at midnight, seen from the sea",
  },
  plan: {
    label: "Your night", h2: "Hour by hour",
    lead: "The times are fixed by the clock at midnight. Everything else follows your mood: slower, longer at the table, more music.",
    items: [
      ["21:45", "Welcome aboard", "Meet your two skippers at Marina do Funchal, Pontoon C. Blankets out, lights on deck, and a first poncha mixed in front of you."],
      ["22:00", "Out into the lit bay", "We leave the marina and cruise slowly along the seafront: the Christmas lights climbing the hills, the cruise ships lit up in the harbour, your playlist on the speakers."],
      ["22:30", "Câmara de Lobos by night", "West along the coast to the fishing village, lit up for the season. The skippers fly the drone over your boat for the shots, while the sky is still quiet."],
      ["23:00", "Dinner on deck", "The Madeiran table comes out: warm bolo do caco, prawns, local fish, cheese and ham, with Madeira wine and Portuguese wine."],
      ["23:30", "Into position", "Back into Funchal bay. The skippers take the boat to their spot, at the distance the port authority sets. Glasses filled, twelve raisins in every hand."],
      ["00:00", "Midnight", "About eight minutes of fireworks all around the bay, the ships' horns, Champagne. The Insta360 records the whole show, so you can just watch."],
      ["00:15", "The bay celebrates", "Stay in the glow while the city parties. Bolo de mel, tropical fruit, one more round."],
      ["00:50", "Back to the marina", "Ashore by 01:00, in the centre of Funchal, close to the main hotels."],
    ],
  },
  inc: {
    label: "All included", h2: "Everything on board,<br>nothing to add",
    lead: "One price for the whole boat. No drinks list, no extras at the end of the night.",
    groups: [
      ["Madeiran dinner on deck", [
        "Bolo do caco, the island's flatbread, warm with garlic butter",
        "Garlic prawns and bites of espada, Madeira's own black scabbard fish",
        "Madeiran cheese and Portuguese cured ham",
        "Tropical fruit from the island: passion fruit, banana, custard apple",
        "Bolo de mel, the honey cake Madeira bakes for Christmas",
        "Twelve raisins each at midnight, the Portuguese way: one wish per chime",
      ]],
      ["Drinks, local first", [
        "Champagne for the midnight toast",
        "Poncha, mixed on board the traditional way",
        "Madeira wine, the island's own",
        "Portuguese white and red wine",
        "Coral, the Madeiran beer",
        "Brisa passion fruit, Laranjada, still and sparkling water",
      ]],
      ["Your night on film", [
        "Insta360 360° video of the whole night, fireworks included",
        "Drone shots of your boat in the lit bay, before the show (weather and flight rules allowing, never during the fireworks)",
        "Photos taken with a real camera",
        "Everything sent to you after the trip",
      ]],
      ["On board", [
        "The whole boat for your group: a 2026 Karnic R8S, toilet on board",
        "Two licensed skippers from Madeira",
        "Blankets and warm lights on deck for a December night",
        "Your own playlist on the speakers",
        "Tell us about allergies, vegetarian or no alcohol: we adapt the menu",
      ]],
    ],
  },
  book: {
    label: "Book", h2: "One boat. One night.<br><em>One group.</em>",
    unit: "for the whole boat, up to 5 guests, everything included",
    facts: [["Date", "Thursday 31 December 2026"], ["On the water", "22:00 to 01:00 (meet at 21:45)"], ["Meeting point", "Marina do Funchal, Pontoon C"], ["Guests", "1 to 5, the price does not change"]],
    note: "There is only one boat, so this night can be sold once. Free cancellation up to 24 hours before departure. If the sea or the port authority stops boats on the night, you get a full refund.",
    name: "Your name", email: "Email", phone: "Phone, WhatsApp works", guests: "Guests",
    pay: "Book the night · €3,000", busy: "Opening the payment page…",
    small: "You pay by card on Stripe. The night is held for you the moment you open the payment page.",
    s: {
      checking: "Checking the night…",
      open: "Still free. The first group to pay gets the boat.",
      held: "Someone is on the payment page for this night right now. If they stop, it opens again within 30 minutes.",
      taken: "This night is booked. Message us for next year's fireworks or for another evening.",
      past: "This night has passed. See you for the next New Year.",
      closed: "Booking for this night is closed. Message us on WhatsApp.",
      error: "We could not check the night just now. Try again, or message us on WhatsApp.",
      cancelled: "The payment was not finished, so nothing was charged. The night is still free while it says so above.",
    },
    e: { name: "Please give your name.", email: "Please give a valid email.", phone: "Please give a phone number (WhatsApp works).", fail: "Could not open the payment page. Please try again." },
  },
  faq: {
    label: "Good to know", h2: "New Year's Eve on the boat: questions",
    items: [
      ["When do the Madeira New Year fireworks start, and how long do they last?", "At midnight, from 31 December to 1 January. The show lasts about eight minutes and fires from many points around Funchal bay at the same time, so the whole city lights up in a circle. The ships in the harbour sound their horns at midnight."],
      ["Why watch the fireworks from a boat?", "The fireworks go up all around the bay, so the best seat is in the middle of it. On land the seafront is full from early evening and the streets close; on the boat you have the whole view, no crowd, and the reflections on the water."],
      ["What is included in the €3,000?", "Everything on this page: the whole boat for three hours, two skippers, a Madeiran dinner on deck, Champagne at midnight, poncha, Madeira wine, Portuguese wine, beer and soft drinks, Insta360 360° video of the night, drone shots before the show, camera photos and blankets. The price is for the whole boat, from 1 to 5 guests."],
      ["What if the weather is bad?", "The skippers decide on the day, for your safety. If the sea is too rough or the port authority stops boats from going out, you get a full refund. We tell you as early as we can."],
      ["Is it cold on the water at night in December?", "Funchal is mild in winter, around 15 °C at night, but it feels cooler on the water. Bring a warm layer and a jacket. Blankets are on board."],
      ["Can children come?", "Yes, of any age. There are life jackets in every size. The boat takes 5 guests in total, children included."],
      ["Do you have vegetarian or alcohol free options?", "Yes. Tell us when you book (we write to you on WhatsApp after payment) and we adapt the menu and the drinks."],
      ["Where do we meet, and how do we get back?", "Marina do Funchal, Pontoon C, at 21:45. We are back at 01:00 in the centre of Funchal, a short walk from the main hotels. Taxis are busy on New Year's night: book one ahead, or ask us and we help."],
      ["Can I cancel?", "Yes, free of charge up to 24 hours before departure."],
    ],
  },
  reserve: { lbl: "Marina do Funchal · Pontoon C", h2: "Start the year <em>on the water</em>", p: "One boat, one night, one group: 31 December 2026, 22:00 to 01:00, everything included.", bookLabel: "Book the night", wa: "Message the skippers", call: "Or call directly" },
  ribbon: { k: "31 Dec 2026", t: "New Year's Eve fireworks from the water", cta: "See the night" },
};

Object.assign(T, I18N);

// ---------------------------------------------------------------- page CSS
const CSS = `
.nye-book{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(24px,4vw,56px);align-items:start}
.nye-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:18px 0 20px}
.nye-price .amt{font-family:var(--serif);font-size:clamp(2.6rem,5vw,3.6rem);line-height:1}
.nye-price .unit{color:var(--mist);font-size:.95rem;max-width:30ch}
.nye-facts{list-style:none;margin:0 0 18px;padding:0;border-top:1px solid var(--line)}
.nye-facts li{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--line);font-size:.95rem}
.nye-facts li span{color:var(--mist)}
.nye-facts li b{font-weight:600;text-align:right}
.nye-note{color:var(--mist);font-size:.9rem;max-width:56ch}
.nye-form{border:1px solid var(--line-2,var(--line));border-radius:var(--radius-lg,14px);padding:26px 24px;box-shadow:var(--m-shadow)}
.nye-form label{display:block;font-size:.82rem;font-weight:600;letter-spacing:.01em;margin:14px 0 6px}
.nye-form input,.nye-form select{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid var(--line-2,var(--line));background:transparent;color:inherit;font:inherit;font-size:1rem}
.nye-form input:focus,.nye-form select:focus{outline:2px solid var(--m-gold);outline-offset:1px}
.nye-form .btn{width:100%;justify-content:center;margin-top:20px}
.nye-form .btn[disabled]{opacity:.45;cursor:not-allowed}
.nye-status{padding:12px 14px;border-radius:10px;background:rgba(90,120,150,.12);font-size:.92rem;line-height:1.45}
.nye-status[data-s="open"]::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#2e9d6a;margin-right:8px;vertical-align:1px}
.nye-err{color:#c0392b;font-size:.9rem;margin-top:10px;min-height:1.2em}
.nye-small{color:var(--mist);font-size:.82rem;margin:8px 0 0}
.nye-inc{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:26px}
.nye-inc .g{border:1px solid var(--line);border-radius:var(--radius-lg,14px);padding:22px 20px}
.nye-inc h3{font-size:1.25rem;margin:0 0 12px}
.nye-inc ul{list-style:none;margin:0;padding:0}
.nye-inc li{position:relative;padding:7px 0 7px 22px;font-size:.92rem;line-height:1.45;border-top:1px solid var(--line)}
.nye-inc li:first-child{border-top:0}
.nye-inc li::before{content:"";position:absolute;left:2px;top:14px;width:7px;height:7px;border-radius:50%;background:var(--m-gold)}
@media (max-width:1100px){.nye-inc{grid-template-columns:repeat(2,1fr)}}
@media (max-width:820px){.nye-book{grid-template-columns:1fr}}
@media (max-width:560px){.nye-inc{grid-template-columns:1fr}.nye-form{padding:22px 18px}}
`;

// ---------------------------------------------------------------- blocks
function bookBlock(t, lang) {
  const b = t.book;
  const strings = { s: b.s, e: b.e, pay: b.pay, busy: b.busy };
  return `<section class="chapter" style="padding-top:0" id="book">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">04</span><span class="cl">${b.label}</span></div>
    <div class="nye-book">
      <div>
        <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem)">${b.h2}</h2>
        <div class="nye-price reveal d1"><span class="amt">${t.price}</span><span class="unit">${b.unit}</span></div>
        <ul class="nye-facts reveal d1">
${b.facts.map(([k, v]) => `          <li><span>${k}</span><b>${v}</b></li>`).join("\n")}
        </ul>
        <p class="nye-note reveal d2">${b.note}</p>
      </div>
      <form class="nye-form reveal d1" id="nye-form" novalidate>
        <div class="nye-status" id="nye-status" role="status" aria-live="polite">${b.s.checking}</div>
        <label for="nye-n">${b.name}</label><input id="nye-n" name="name" autocomplete="name" required>
        <label for="nye-e">${b.email}</label><input id="nye-e" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
        <label for="nye-p">${b.phone}</label><input id="nye-p" name="phone" type="tel" autocomplete="tel" placeholder="+351 900 000 000" required>
        <label for="nye-g">${b.guests}</label><select id="nye-g" name="guests">${Array.from({ length: NYE.guests }, (_, i) => `<option value="${i + 1}"${i === 1 ? " selected" : ""}>${i + 1}</option>`).join("")}</select>
        <button class="btn btn-p btn-lg" type="submit" disabled>${b.pay}</button>
        <div class="nye-err" id="nye-err" role="alert"></div>
        <p class="nye-small">${b.small}</p>
      </form>
    </div>
  </div>
</section>
<script>
(function () {
  "use strict";
  var API = "https://chifbay-booking-api.chifandcopt.workers.dev", ID = ${JSON.stringify(NYE.quote)}, AMOUNT = ${NYE.amount}, LANG = ${JSON.stringify(lang)};
  var T = ${JSON.stringify(strings)};
  var form = document.getElementById("nye-form"), st = document.getElementById("nye-status"), err = document.getElementById("nye-err");
  var btn = form.querySelector("button");
  function show(k, extra) { st.dataset.s = k; st.textContent = (extra ? extra + " " : "") + T.s[k]; btn.disabled = k !== "open"; }
  var cancelled = /[?&]cancelled=1/.test(location.search) ? T.s.cancelled : "";
  fetch(API + "/v1/quote?id=" + ID)
    .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? "closed" : "error"); return r.json(); })
    .then(function (q) {
      // the page text and the store must agree on the price, or nobody pays
      if (q.deposit !== AMOUNT || q.kind !== "full") return show("closed");
      if (q.state !== "open") return show("closed");
      show(q.availability || "error", q.availability === "open" ? cancelled : "");
    })
    .catch(function (e) { show(e && e.message === "closed" ? "closed" : "error"); });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (btn.disabled) return;
    var name = form.name.value.trim(), email = form.email.value.trim(), phone = form.phone.value.trim();
    err.textContent = "";
    if (name.length < 2) { err.textContent = T.e.name; form.name.focus(); return; }
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) { err.textContent = T.e.email; form.email.focus(); return; }
    if (phone.replace(/[^\\d]/g, "").length < 6) { err.textContent = T.e.phone; form.phone.focus(); return; }
    btn.disabled = true; btn.textContent = T.busy;
    fetch(API + "/v1/quote-checkout", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ID, name: name, email: email, phone: phone, guests: +form.guests.value, lang: LANG }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j.url) { location.href = x.j.url; return; }
        throw new Error((x.j && x.j.error) || T.e.fail);
      })
      .catch(function (e) { err.textContent = (e && e.message) || T.e.fail; btn.disabled = false; btn.textContent = T.pay; });
  });
})();
</script>`;
}

function incBlock(t) {
  const s = t.inc;
  return `<section class="chapter" style="padding-top:0" id="included">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">03</span><span class="cl">${s.label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:10px">${s.h2}</h2>
    <p class="reveal d1" style="max-width:56ch;color:var(--mist)">${s.lead}</p>
    <div class="nye-inc">
${s.groups.map(([h, li], i) => `      <div class="g reveal${i ? ` d${Math.min(i, 3)}` : ""}">
        <h3>${h}</h3>
        <ul>
${li.map((x) => `          <li>${x}</li>`).join("\n")}
        </ul>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------- pages
export function nyePages(h) {
  const { ed, timeline, faq, reserve, WA } = h;
  // timeline icons that peak.css draws: anchor boat cliff drone snorkel sun swim village
  const ICONS = ["anchor", "boat", "drone", "boat", "boat", "sun", "boat", "anchor"];
  const IMG = {
    hero: "journal/fireworks-over-funchal-bay-festival-madeira",
    intro: "journal/funchal-christmas-lights-new-year-fireworks-bay",
    reserve: "journal/funchal-at-night-lights-reflected-sea-boat",
  };
  return LANGS.filter((l) => T[l]).map((lang) => {
    const t = T[lang];
    const slug = slugFor(lang);
    const faqData = { n: "05", ...t.faq };
    return {
      slug, lang, alternates: ALTS.filter(([l]) => T[l]), css: CSS, group: "nye",
      title: t.title, description: t.description,
      heroImg: IMG.hero, heroAlt: t.heroAlt, badge: t.badge, h1: t.h1, hsub: t.hsub,
      book: "#book", bookLabel: t.bookLabel, waLabel: t.waLabel, meta: t.meta,
      crumbs: t.crumbs,
      sbar: { aria: t.sbar.aria, k: t.sbar.k, v: t.price, href: "#book", label: t.sbar.label },
      event: {
        name: t.event.name, description: t.event.description,
        startDate: `${NYE.date}T${NYE.start}:00+00:00`, endDate: `2027-01-01T${NYE.end}:00+00:00`,
        price: NYE.amount / 100, capacity: NYE.guests,
      },
      faq: faqData,
      sections: (p) => [
        ed(p, { n: "01", label: t.intro.label, h2: t.intro.h2, paras: t.intro.paras, cta: ["#book", t.bookLabel],
          img: IMG.intro, alt: t.heroAlt, cap: t.intro.cap }),
        timeline({ n: "02", label: t.plan.label, h2: t.plan.h2, lead: t.plan.lead,
          items: t.plan.items.map(([time, head, text], i) => [time, ICONS[i] || "boat", head, text]) }),
        incBlock(t),
        bookBlock(t, lang),
        faq(faqData),
        reserve(p, { img: IMG.reserve, ...t.reserve, book: "#book" }),
      ],
      _wa: WA,
    };
  });
}

/** The small strip that points to the night from the experiences pages. */
export function nyeRibbon(lang) {
  const t = T[lang];
  if (!t) return "";
  const href = `/${slugFor(lang)}`;
  return `<!-- nye-offer -->
<a class="nye-ribbon" href="${href}" data-until="2027-01-01">
  <span class="k">${t.ribbon.k}</span><span class="t">${t.ribbon.t}</span><span class="v">${t.price} · ${t.ribbon.cta} →</span>
</a>
<script>(function(){var a=document.currentScript.previousElementSibling;if(new Date()>=new Date(a.dataset.until+"T01:00:00Z"))a.remove();})();</script>
<!-- /nye-offer -->`;
}

export const NYE_LANGS = () => LANGS.filter((l) => T[l]);
export { T as NYE_TEXT };
