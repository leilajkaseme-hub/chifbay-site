/* Chifbay on-site booking.
 *
 * One engine, three pages. The page says which trips it sells:
 *
 *   <main id="bkbox" data-trip="sunset">    -> only the sunset options
 *   <main id="bkbox" data-trip="day-trip">  -> only the day-trip options
 *   <main id="bkbox">                       -> everything
 *
 * A link may also pre-select one option and drop the visitor straight on the
 * calendar:  /book-sunset.html?v=cabo-girao
 *
 * Everything here is public on purpose. The only Stripe key in this file is the
 * PUBLISHABLE key, which Stripe designs to be readable by anyone. The secret
 * key lives only in the Cloudflare Worker — never in this repo, which is public.
 *
 * The browser never sends a price. It sends a trip id and a variant id, and the
 * Worker decides what that costs.
 */
(function () {
  "use strict";

  var CFG = {
    // Worker address. While testing this is the workers.dev one; once the
    // custom domain is on, it becomes https://api.chifbay.com
    API: window.CHIFBAY_API || "https://chifbay-booking-api.chifandcopt.workers.dev",
    // Stripe publishable key. pk_test_... while testing, pk_live_... when live.
    PK: window.CHIFBAY_STRIPE_PK || "",
    DAYS_AHEAD: 60,
    WA: "https://wa.me/351937200320",
  };

  var C = window.CHIFBAY_CONTENT;
  var t = C ? C.t : function (k) { return k; };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = {
    catalogue: null,
    only: null,        // trip id this page sells, or null for all of them
    trip: null,
    variant: null,
    date: null,
    time: null,
    availability: {},
    month: null,       // first day of the month being shown, as YYYY-MM-01
    checkout: null,    // the mounted Stripe embedded checkout
  };

  /* ------------------------------------------------------------ small utils */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function eurOnly(cents) {
    return "\u20ac" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  }

  function fxOnly(cents) {
    var fx = window.CHIFBAY_FX;
    return (fx && fx.estimate(cents)) || "";
  }

  function money(cents) {
    var eur = "€" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
    // fx.js is what decides whether there is anything to add here — see its
    // header comment for why this is a clearly-marked ESTIMATE, never the
    // number Stripe actually charges.
    var fx = window.CHIFBAY_FX;
    var est = fx && fx.estimate(cents);
    return est ? eur + ' <span class="bkfxest">≈ ' + est + '</span>' : eur;
  }

  /* "3h", "2h30" — never "3 h" or "2 h 30". The space was the whole problem:
     it broke the number in two, so the eye read it as a stray letter rather
     than a duration. The compact form is also the one every OTA uses. */
  function dur(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    if (!h) return m + " " + t("ui.minsShort");
    return h + t("ui.hoursShort") + (m ? pad(m) : "");
  }

  /* The long form, for the one place with room to spell it out. */
  function durLong(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    var out = h ? t(h === 1 ? "ui.hourOne" : "ui.hourMany", { n: h }) : "";
    return m ? out + " " + m + " " + t("ui.minsShort") : out;
  }

  /* When you get back. This is what the guest is actually asking when they
     look for the duration — "am I back in time for dinner" — and no page on
     the site answered it. Departure times are local Funchal time. */
  function endTime(hhmm, minutes) {
    var p = hhmm.split(":").map(Number);
    var total = (p[0] * 60 + p[1] + minutes) % 1440;
    return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
  }

  function endTimes(times, minutes) {
    return times.map(function (x) { return endTime(x, minutes); });
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function ymd(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function parseYmd(s) {
    var p = s.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function addDays(s, n) {
    var d = parseYmd(s);
    d.setUTCDate(d.getUTCDate() + n);
    return ymd(d);
  }

  function locale() { return (C && C.lang) || document.documentElement.lang || "en"; }

  /* ?test=<token> lets the owner put a real card through the real live flow at
     a tenth of the price, to prove 3D Secure works. The Worker decides whether
     the token is real; the browser only carries it. */
  function testToken() {
    var m = /[?&]test=([A-Za-z0-9_-]{8,120})/.exec(location.search);
    return m ? m[1] : "";
  }

  function longDate(s) {
    var d = parseYmd(s);
    return d.toLocaleDateString(locale(), {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  function api(path, opts) {
    return fetch(CFG.API + path, opts).then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw new Error(body && body.error ? body.error : "Request failed");
        return body;
      });
    });
  }

  function say(msg, kind) {
    var box = $("#bkmsg");
    if (!box) return;
    box.textContent = msg || "";
    box.className = "bkmsg" + (msg ? " on " + (kind || "err") : "");
  }

  /* Scrolls so `el` lands just under the fixed nav, rather than merely
     "into view" — a smooth scroll that only guarantees the target is
     somewhere on screen still lets it end up half-hidden behind the bar,
     or (with scrollIntoView on an ancestor) jump to a completely different
     element than the one you actually wanted to see. */
  function scrollUnderNav(el) {
    if (!el) return;
    var nav = $("#nav");
    // measured live, not a hardcoded pixel count: the nav's height changes
    // between mobile and desktop, and the announcement bar above it is only
    // sometimes there — nav.getBoundingClientRect().bottom already reflects
    // both, on every page, without hand-tuning a number per layout.
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
    var y = el.getBoundingClientRect().top + window.pageYOffset - navBottom - 16;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  function step(n) {
    $$(".bkstep").forEach(function (el) {
      el.classList.toggle("on", Number(el.dataset.step) === n);
    });
    $$(".bkdot").forEach(function (el) {
      var s = Number(el.dataset.step);
      el.classList.toggle("done", s < n);
      el.classList.toggle("now", s === n);
    });
    // The dots sit right above whichever step is showing, so this is one
    // stable anchor for the whole funnel — #bkbox itself starts with the
    // route map, and scrolling to THAT on every "Continue" click is the bug
    // being fixed here: it always jumped back up past the map instead of to
    // the step you had just moved to.
    scrollUnderNav($(".bksteps"));
  }

  /* Every trip/variant pair this page is allowed to sell, in catalogue order. */
  function offers() {
    var out = [];
    if (!state.catalogue) return out;
    Object.keys(state.catalogue.trips).forEach(function (tripId) {
      if (state.only && tripId !== state.only) return;
      var trip = state.catalogue.trips[tripId];
      Object.keys(trip.variants).forEach(function (varId) {
        out.push({ tripId: tripId, varId: varId, trip: trip, v: trip.variants[varId] });
      });
    });
    return out;
  }

  /* ------------------------------------------------------------- the map */

  // Real sailing distance from Marina do Funchal, turned into an x position.
  // The scale is set by the FURTHEST stop this page can reach, so a sunset
  // page (which turns at Ribeira Brava, 14 km) fills the same width as the
  // day-trip page (Ponta do Sol, 17.5 km) instead of trailing off into
  // empty water.
  var MAP_X0 = 828, MAP_SPAN = 760;
  var MAP_Y = 140;                 // the sea lane the boat runs along

  /** The stops this page is allowed to draw at all, in coast order. */
  function pageStops() {
    return (C && C.stopsFor ? C.stopsFor(state.only) : C.stops.map(function (s) { return s.id; }));
  }
  function kmOf(id) { var s = C.stop(id); return s ? s.km : 0; }
  function maxKm(ids) {
    return ids.reduce(function (m, id) { return Math.max(m, kmOf(id)); }, 0) || 1;
  }

  // A stylised elevation profile of the real coast, in [km, farY, landY] —
  // smaller Y is TALLER. Straight segments read as jagged volcanic cliffs,
  // closer to Madeira's real coast than a smooth curve. Cabo Girão is the
  // one dramatic peak (the second-highest sea cliff on Earth); Ribeira Brava
  // is a river-mouth valley, the lowest point on the whole stretch. Every
  // page uses the full table — points past this page's own turning point
  // land at a negative x from mapX() and are simply clipped by the SVG.
  var TERRAIN = [
    [0, 44, 58], [3, 50, 64], [6, 48, 62], [7.5, 30, 42], [9, 8, 20],
    [10.5, 26, 38], [11.5, 36, 50], [12.75, 46, 60], [14, 70, 88],
    [15.5, 48, 62], [17.5, 42, 56], [19.5, 46, 60],
  ];

  /** West is drawn on the LEFT on purpose — Funchal sits east on this coast,
   *  so on any ordinary north-up map the route runs left, exactly like a real
   *  chart of the south coast would show it. col: 1 = far layer, 2 = land. */
  function terrainPath(mapX, baseY, col) {
    var d = "M900,0 H900 V" + baseY;
    TERRAIN.forEach(function (row) { d += " L" + mapX(row[0]).toFixed(1) + "," + row[col]; });
    var lastX = mapX(TERRAIN[TERRAIN.length - 1][0]);
    d += " L" + Math.min(0, lastX).toFixed(1) + "," + TERRAIN[TERRAIN.length - 1][col] + " Z";
    return d;
  }

  // The same gold line-icon set used on the tour pages' itinerary timeline
  // (peak.css, [data-ic]) — anchor/cliff/boat/sun are the identical paths, so
  // a visitor sees the same glyph for the same place in both spots. fisher
  // and cove are new, drawn in the same 24x24 / 1.4-stroke / round-cap style.
  var ICON_PATHS = {
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13"/><path d="M8 11h8"/><path d="M5 15a7 7 0 0 0 14 0"/>',
    fisher: '<path d="M3 12c3.5-4 9-6 13-3.2-1 1.8-1 5.6 0 7.4-4 2.8-9.5.8-13-3.2Z"/>' +
      '<path d="M17 9.6 21 12l-4 2.4"/><circle class="eye" cx="7.4" cy="11.3" r=".9" stroke="none"/>',
    cliff: '<path d="M3 18 9 5l5 9 3-4 4 8Z"/>' +
      '<path d="M2 21c2 0 2-1.4 4-1.4S8 21 10 21s2-1.4 4-1.4S16 21 18 21s2-1.4 4-1.4"/>',
    cove: '<path d="M4 4v9a8 8 0 0 0 16 0V4"/><path d="M4 4h4M16 4h4"/>',
    boat: '<path d="M3 17h18l-2 4H5Z"/><path d="M12 14V4l6 6-6 4"/><path d="M12 14 6 11"/>',
    sun: '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  };
  function iconMarkup(id) {
    var d = ICON_PATHS[id];
    if (!d) return "";
    var s = 14 / 24; // rendered size 14px, drawn in a 24x24 box
    return '<g class="bkmicon" transform="translate(' + (-7).toFixed(1) + "," + (-31).toFixed(1) +
      ") scale(" + s.toFixed(4) + ')">' + d + "</g>";
  }

  // Standalone version of the same glyph for the mobile list (bkrl) — the map
  // icons live inside the big coordinate-transformed <g>, this one is a plain
  // self-contained <svg> sized in normal flow next to the place name.
  function listIconMarkup(id) {
    var d = ICON_PATHS[id];
    if (!d) return "";
    return '<svg class="bkrlicon" viewBox="0 0 24 24" aria-hidden="true">' + d + "</svg>";
  }

  /**
   * routeIds — the stops this option visits, or null before anything is picked.
   * With null the page's whole reachable coast is drawn and nothing is marked
   * as the turn: "we turn here" would be a lie before a length is chosen.
   */
  function drawMap(routeIds) {
    var host = $("#bkmap");
    if (!host || !C) return;

    var universe = pageStops();
    var span = maxKm(universe);
    var mapX = function (km) { return MAP_X0 - (km / span) * MAP_SPAN; };

    var picked = !!(routeIds && routeIds.length);
    var ids = picked ? routeIds : universe;
    var turn = picked ? ids[ids.length - 1] : null;
    var turnKm = turn ? kmOf(turn) : span;

    // Labels alternate between two rows. Six place names on one row would
    // collide — Fajã dos Padres and Ribeira Brava are only 2.5 km apart.
    var marks = "";
    universe.forEach(function (id, i) {
      var s = C.stop(id);
      if (!s) return;
      var on = ids.indexOf(id) !== -1;
      var isTurn = id === turn;
      var low = i % 2 === 1;                       // second row
      var ny = low ? 62 : 28, cy = low ? 80 : 46;
      marks +=
        '<g class="bkms' + (on ? " on" : "") + (isTurn ? " turn" : "") +
          '" transform="translate(' + mapX(s.km).toFixed(1) + "," + MAP_Y + ')">' +
          (low ? '<line class="bkmtick" x1="0" y1="10" x2="0" y2="46"/>' : "") +
          (isTurn ? '<circle class="bkmring" r="12"/>' : "") +
          iconMarkup(s.icon) +
          '<circle class="bkmdot" r="5.5"/>' +
          '<text class="bkmn" y="' + ny + '">' + esc(s.name) + "</text>" +
          '<text class="bkmc" y="' + cy + '">' +
            esc(isTurn ? t("stop.turn") : t("stop." + id)) + "</text>" +
        "</g>";
    });

    var svg =
      '<svg class="bkmapsvg" viewBox="0 0 900 244" role="img" aria-label="' +
        esc(t("map.title")) + '" preserveAspectRatio="xMidYMid meet">' +
      "<defs>" +
        '<linearGradient id="bkmsea" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#0a1b2c"/><stop offset="100%" stop-color="#050f18"/>' +
        "</linearGradient>" +
      "</defs>" +
      '<rect x="0" y="86" width="900" height="158" fill="url(#bkmsea)"/>' +
      // The mountains behind, then the coastline itself — both traced through
      // TERRAIN via the SAME mapX() as the stop markers, so the one peak in
      // the skyline always lands exactly over the Cabo Girão dot, whatever
      // this page's own distance scale is.
      '<path class="bkmfar" d="' + terrainPath(mapX, 84, 1) + '"/>' +
      '<path class="bkmland" d="' + terrainPath(mapX, 96, 2) + '"/>' +
      // open water
      '<path class="bkmwave" d="M60,116 q46,-7 92,0 t92,0 t92,0 t92,0 t92,0 t92,0 t92,0 t92,0"/>' +
      // the run west, and how far this option goes
      '<path class="bkmtrack dim" d="M' + mapX(0) + "," + MAP_Y + " H" + mapX(span).toFixed(1) + '"/>' +
      '<path class="bkmtrack" d="M' + mapX(0) + "," + MAP_Y + " H" + mapX(turnKm).toFixed(1) + '"/>' +
      // Fixed near the top, clear of the sky above the terrain — MAP_Y-16 put
      // these right where the sun/anchor icons now sit, right over Ponta do
      // Sol and Funchal.
      '<text class="bkmedge" text-anchor="start" x="18" y="22">← ' +
        esc(t("map.west")) + "</text>" +
      '<text class="bkmedge" text-anchor="end" x="882" y="22">' +
        esc(t("map.home")) + "</text>" +
      marks +
      "</svg>";

    // Below 760px the SVG labels would render at about 6px. The same route is
    // repeated as a plain vertical list and CSS shows one or the other.
    var list = '<ol class="bkrl">';
    universe.forEach(function (id) {
      if (ids.indexOf(id) === -1) return;
      var s = C.stop(id);
      if (!s) return;
      var isTurn = id === turn;
      list += '<li' + (isTurn ? ' class="turn"' : "") + "><b>" + listIconMarkup(s.icon) +
        esc(s.name) + "</b><span>" +
        esc(isTurn ? t("stop.turn") : t("stop." + id)) + "</span></li>";
    });
    list += "</ol>";

    host.innerHTML = svg + list;

    // the caption quotes the distance, so it has to match the map above it
    var cap = $(".bkmapc");
    if (cap) cap.textContent = t("map.caption", { km: String(Math.round(span)) });
  }

  /* --------------------------------------------------------- step 1 choose */

  function routeStrip(tripId, varId) {
    var c = C && C.variant(tripId, varId);
    if (!c) return "";
    var turn = c.route[c.route.length - 1];
    var parts = c.route.map(function (id) {
      var s = C.stop(id);
      if (!s) return "";
      return '<span class="bkrtp' + (id === turn ? " turn" : "") + '">' + esc(s.name) + "</span>";
    });
    return '<div class="bkrt">' + parts.join('<span class="bkrta" aria-hidden="true">›</span>') + "</div>";
  }

  /* One card per TRIP, not one per variant.
   *
   * It used to be one card per variant: four cards, each about 790px tall on a
   * phone — 85% of the screen. You saw one at a time, the two Day Trip lengths
   * were a full screen apart, and the last Sunset option only appeared on the
   * fifth screen of a 6.4-screen page. Comparing "2h30 at 500" with "3h at
   * 600" meant scrolling back and forth between two cards that looked the
   * same, which is also why the page read as one long undifferentiated flow.
   *
   * Now the lengths are a switch at the top of one card. Both prices are
   * visible at once, choosing is a tap instead of a scroll, and the page holds
   * two clearly different products instead of four near-identical blocks.
   */
  function variantBody(o) {
    var hls = (C && C.highlights(o.tripId, o.varId)) || [];
    return (
      "<h3>" + esc(o.v.name) + "</h3>" +
      "<p>" + esc(t("blurb." + o.tripId + "/" + o.varId) || o.v.blurb) + "</p>" +
      routeStrip(o.tripId, o.varId) +
      (hls.length
        ? '<ul class="bkcl">' + hls.map(function (h) {
            return '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
              esc(h) + "</li>";
          }).join("") + "</ul>"
        : "") +
      '<span class="bkcmeta">' + esc(t("ui.departs")) + " " +
        esc(o.trip.times.join(" " + t("ui.or") + " ")) + " · " +
        esc(t("ui.backBy")) + " " +
        esc(endTimes(o.trip.times, o.v.minutes).join(" " + t("ui.or") + " ")) + " · " +
        esc(t("ui.upTo", { n: state.catalogue.maxGuests })) + "</span>"
    );
  }

  function renderTrips() {
    var wrap = $("#bktrips");
    if (!wrap) return;
    wrap.innerHTML = "";

    // Group the flat offer list back into one entry per trip, order preserved.
    var groups = [];
    offers().forEach(function (o) {
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].tripId === o.tripId) g = groups[i];
      if (!g) { g = { tripId: o.tripId, trip: o.trip, variants: [] }; groups.push(g); }
      g.variants.push(o);
    });

    groups.forEach(function (g) {
      var card = document.createElement("article");
      card.className = "bkcard";
      card.dataset.trip = g.tripId;

      // Each length can have its own photo; the switch swaps it too.
      var pics = g.variants.map(function (o, i) {
        var c = C && C.variant(o.tripId, o.varId);
        if (!c || !c.photo) return "";
        return '<img class="bkcimg" data-i="' + i + '" src="' +
          esc(c.photo) + '" alt="' + esc(c.alt || o.v.name) +
          '" loading="lazy" decoding="async" width="640" height="360">';
      }).join("");

      // The switch carries BOTH numbers a guest compares. That is the whole
      // point: no tap needed to see what the other length costs.
      var segs = g.variants.map(function (o, i) {
        return '<button type="button" class="bkseg" data-i="' + i +
          '" role="tab" aria-selected="false">' +
          "<b>" + esc(dur(o.v.minutes)) + "</b>" +
          '<em>' + esc(eurOnly(o.v.amount)) + "</em></button>";
      }).join("");

      card.innerHTML =
        (pics ? '<div class="bkcpic">' + pics + "</div>" : "") +
        '<div class="bkcbody">' +
          '<span class="bkck">' + esc(g.trip.name) + "</span>" +
          (g.variants.length > 1
            ? '<div class="bksegs" role="tablist" aria-label="' + esc(g.trip.name) + '">' + segs + "</div>"
            : "") +
          '<div class="bkfx"></div>' +
          '<div class="bkvar"></div>' +
          '<div class="bkcfoot">' +
            '<button type="button" class="bkbtn bksm">' + esc(t("ui.choose")) +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
          "</div>" +
        "</div>";

      // Longest first, deliberately. It is the better trip to sell, and opening
      // on the short one frames the long one as "the expensive one" instead of
      // "the full one". Both prices stay visible either way, so nothing is hidden.
      var chosen = 0;
      for (var vi = 1; vi < g.variants.length; vi++) {
        if (g.variants[vi].v.minutes > g.variants[chosen].v.minutes) chosen = vi;
      }
      function show(i) {
        chosen = i;
        $(".bkvar", card).innerHTML = variantBody(g.variants[i]);
        var est = fxOnly(g.variants[i].v.amount);
        $(".bkfx", card).innerHTML = est ? "\u2248 " + esc(est) : "";
        $$(".bkseg", card).forEach(function (b, k) {
          b.classList.toggle("on", k === i);
          b.setAttribute("aria-selected", String(k === i));
        });
        $$(".bkcimg", card).forEach(function (im, k) { im.classList.toggle("on", k === i); });
      }
      $$(".bkseg", card).forEach(function (b) {
        b.addEventListener("click", function () { show(+b.dataset.i); });
      });
      show(chosen);

      var choose = function () {
        var o = g.variants[chosen];
        select(o.tripId, o.varId);
      };
      $(".bksm", card).addEventListener("click", choose);
      $(".bkcpic", card) && $(".bkcpic", card).addEventListener("click", choose);
      wrap.appendChild(card);
    });
  }

  function select(tripId, varId) {
    if (!state.catalogue.trips[tripId] || !state.catalogue.trips[tripId].variants[varId]) return;
    state.trip = tripId;
    state.variant = varId;
    state.date = null;
    state.time = null;
    $$(".bkcard").forEach(function (c) {
      c.classList.toggle("sel", c.dataset.trip === tripId && c.dataset.variant === varId);
    });
    var c = C && C.variant(tripId, varId);
    drawMap(c ? c.route : null);
    renderPicked();
    loadAvailability();
    step(2);
  }

  /* The little reminder of what they picked, above the calendar. */
  function renderPicked() {
    var box = $("#bkpicked");
    if (!box) return;
    var trip = state.catalogue.trips[state.trip];
    var v = trip.variants[state.variant];
    var c = C && C.variant(state.trip, state.variant);
    box.innerHTML =
      (c && c.photo ? '<img src="' + esc(c.photo) + '" alt="" loading="lazy" decoding="async">' : "") +
      "<div><span class=\"bkck\">" + esc(trip.name) + "</span>" +
      "<strong>" + esc(v.name) + "</strong>" +
      "<span class=\"bkpm\">" + esc(dur(v.minutes)) + " · " + money(v.amount) + " · " +
        esc(t("ui.wholeBoat")) + "</span></div>" +
      '<button type="button" class="bkback" data-back="1">' + esc(t("ui.change")) + "</button>";
    $("[data-back]", box).addEventListener("click", function () { step(1); });
  }

  /* ------------------------------------------------------- step 2 date/time */

  function loadAvailability() {
    var today = new Date();
    var from = ymd(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    var to = addDays(from, CFG.DAYS_AHEAD);
    state.month = from.slice(0, 8) + "01";
    $("#bkcal").innerHTML = '<p class="bkload">' + esc(t("ui.checking")) + "</p>";
    api("/v1/availability?trip=" + encodeURIComponent(state.trip) +
        "&variant=" + encodeURIComponent(state.variant) +
        "&from=" + from + "&to=" + to)
      .then(function (res) {
        state.availability = res.days || {};
        renderCalendar();
      })
      .catch(function (e) {
        $("#bkcal").innerHTML = '<p class="bkload">' + esc(t("ui.calFailed")).replace(
          esc(t("ui.whatsapp")),
          '<a href="' + CFG.WA + '">' + esc(t("ui.whatsapp")) + "</a>") + "</p>";
        say(e.message, "err");
      });
  }

  function renderCalendar() {
    var wrap = $("#bkcal");
    var first = parseYmd(state.month);
    var y = first.getUTCFullYear(), m = first.getUTCMonth();
    var monthName = first.toLocaleDateString(locale(), { month: "long", year: "numeric", timeZone: "UTC" });

    // Monday-first grid.
    var lead = (first.getUTCDay() + 6) % 7;
    var daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    var html = '<div class="bkcalhead">' +
      '<button type="button" class="bknav" data-dir="-1" aria-label="Previous month">‹</button>' +
      "<strong>" + esc(monthName) + "</strong>" +
      '<button type="button" class="bknav" data-dir="1" aria-label="Next month">›</button>' +
      "</div><div class=\"bkgrid\">";

    // Day names straight from the browser, so /fr/ gets French ones.
    for (var w = 0; w < 7; w++) {
      var probe = new Date(Date.UTC(2024, 0, 1 + w)); // 2024-01-01 was a Monday
      html += '<span class="bkdow">' +
        esc(probe.toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" })) + "</span>";
    }
    for (var i = 0; i < lead; i++) html += "<span></span>";
    for (var d = 1; d <= daysInMonth; d++) {
      var key = y + "-" + pad(m + 1) + "-" + pad(d);
      var open = state.availability[key];
      html += open
        ? '<button type="button" class="bkday' + (state.date === key ? " sel" : "") +
          '" data-date="' + key + '">' + d + "<i></i></button>"
        : '<span class="bkday off">' + d + "</span>";
    }
    html += "</div>";
    wrap.innerHTML = html;

    $$(".bknav", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        var f = parseYmd(state.month);
        f.setUTCMonth(f.getUTCMonth() + Number(b.dataset.dir));
        state.month = ymd(f).slice(0, 8) + "01";
        renderCalendar();
      });
    });
    $$(".bkday[data-date]", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        state.date = b.dataset.date;
        state.time = null;
        renderCalendar();
        renderTimes();
      });
    });
    renderTimes();
  }

  function renderTimes() {
    var box = $("#bktimes");
    if (!state.date) {
      box.innerHTML = '<p class="bkhint">' + esc(t("ui.pickDay")) + "</p>";
      $("#bkto3").disabled = true;
      return;
    }
    var times = state.availability[state.date] || [];
    var html = '<p class="bkhint">' + esc(longDate(state.date)) + " — " +
      esc(t("ui.funchalTime")) + '.</p><div class="bktimerow">';
    times.forEach(function (tm) {
      html += '<button type="button" class="bktime' + (state.time === tm ? " sel" : "") +
        '" data-time="' + esc(tm) + '">' + esc(tm) + "</button>";
    });
    html += "</div>";
    box.innerHTML = html;
    $$(".bktime", box).forEach(function (b) {
      b.addEventListener("click", function () {
        state.time = b.dataset.time;
        renderTimes();
      });
    });
    $("#bkto3").disabled = !state.time;
  }

  /* ---------------------------------------------------------- step 3 detail */

  function renderCountryCodes() {
    var sel = $("#bkcc");
    if (!sel || !C || !C.dialCodes) return;
    var list = C.dialCodes();
    // Flag + the FULL dial code, nothing else. A native <select> shows the
    // same text closed and open, so once the country name rode along the
    // code itself is what got clipped in a narrow box — "+351" turning
    // into "+35" or worse. Dropping the name removes the reason to ever
    // truncate. The name still exists as a hover title, for anyone who
    // wants to confirm which country they landed on.
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + esc(c.dial) + '" data-iso="' + esc(c.iso2) +
        '" title="' + esc(c.name) + '">' + esc(c.flag) + " +" + esc(c.dial) + "</option>";
    }).join("");

    // Several countries share one calling code (+1 covers the US, Canada and
    // half the Caribbean), so <select>.value alone can land on the wrong one
    // of them — match the option by its iso2, not by the dial code alone.
    var guess = C.guessCountry ? C.guessCountry() : "PT";
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].dataset.iso === guess) { sel.selectedIndex = i; break; }
    }
  }

  /** "+351 912345678" — what actually gets sent as the phone number. */
  function fullPhone() {
    var cc = $("#bkcc"), num = $("#bkphone");
    var dial = cc ? cc.value : "";
    var local = (num ? num.value : "").trim();
    return dial ? "+" + dial + " " + local : local;
  }

  function renderSummary() {
    var trip = state.catalogue.trips[state.trip];
    var v = trip.variants[state.variant];
    $("#bksum").innerHTML =
      "<strong>" + esc(trip.name + " — " + v.name) + "</strong>" +
      "<span>" + esc(longDate(state.date)) + "</span>" +
      // The line that was missing everywhere: how long, and when you are back.
      "<span><b>" + esc(state.time + " – " + endTime(state.time, v.minutes)) + "</b> · " +
        esc(durLong(v.minutes)) + " (" + esc(t("ui.funchalTime")) + ")</span>" +
      "<span>" + esc(t("ui.upTo", { n: state.catalogue.maxGuests })) + "</span>" +
      '<span class="bksumprice">' + money(v.amount) + "</span>";
  }

  function startPayment(e) {
    e.preventDefault();
    say("");
    var btn = $("#bkpay");
    btn.disabled = true;
    btn.textContent = t("ui.holding");

    api("/v1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip: state.trip,
        variant: state.variant,
        date: state.date,
        time: state.time,
        guests: Number($("#bkguests").value),
        name: $("#bkname").value,
        email: $("#bkemail").value,
        phone: fullPhone(),
        // Only ever set when the URL carries ?test=<token>. The Worker checks
        // it against a secret; an invalid or missing one simply charges the
        // normal price, so this is harmless to leave in.
        testToken: testToken(),
      }),
    })
      .then(function (res) {
        if (!CFG.PK) throw new Error("Payments are not switched on yet.");
        // Same event the old Wix link used to fire, so the ads keep learning.
        if (window.cbTrack) {
          var v = state.catalogue.trips[state.trip].variants[state.variant];
          window.cbTrack("begin_checkout", "InitiateCheckout", {
            currency: "EUR",
            value: res.amount / 100,
            item_name: state.catalogue.trips[state.trip].name + " — " + v.name,
          });
        }
        step(4);
        return Stripe(CFG.PK).initEmbeddedCheckout({ clientSecret: res.clientSecret });
      })
      .then(function (checkout) {
        state.checkout = checkout;
        checkout.mount("#bkstripe");
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = t("ui.pay");
        step(3);
        say(err.message, "err");
        // If the slot went while they were typing, refresh the calendar.
        if (/taken/i.test(err.message)) loadAvailability();
      });
  }

  /* -------------------------------------------------------------- start up */

  function fillWords() {
    // Text that lives in the markup, so the page reads correctly before the
    // catalogue arrives and in whichever language was asked for.
    $$("[data-t]").forEach(function (el) {
      var s = t(el.dataset.t);
      if (s) el.textContent = s;
    });
  }

  /* Every place a price is currently drawn — safe to call any time, each
     guarded by whether that section has anything to redraw. Used both when
     the visitor switches currency and once fx.js's rates actually arrive
     (money() renders EUR-only until then, then this upgrades it in place). */
  function refreshPrices() {
    if (state.catalogue) renderTrips();
    if (state.trip && state.variant) renderPicked();
    if (state.trip && state.variant && state.date && state.time) renderSummary();
  }

  function renderCurrencyPicker() {
    var sel = $("#bkcur");
    var fx = window.CHIFBAY_FX;
    if (!sel || !fx) return;
    var codes = fx.list();
    sel.innerHTML = codes.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) +
        (c === "EUR" ? "" : " (" + esc(fx.symbol(c)) + ")") + "</option>";
    }).join("");
    sel.value = fx.get().code;
    sel.addEventListener("change", function () {
      fx.set(sel.value);
      refreshPrices();
    });
  }

  function init() {
    var root = $("#bkbox");
    if (!root) return;

    state.only = root.dataset.trip || null;
    fillWords();

    // Make a discounted run impossible to mistake for the real thing.
    if (testToken()) {
      var warn = document.createElement("p");
      warn.className = "bktest";
      warn.textContent =
        "TEST MODE — this link charges 90% less than the price shown. " +
        "A real card, a real charge, a real booking. Refund it afterwards.";
      root.insertBefore(warn, root.firstChild);
    }

    // The map needs no network, so draw it straight away — the page is never
    // empty while the calendar loads.
    drawMap(null);

    api("/v1/catalogue")
      .then(function (cat) {
        state.catalogue = cat;

        // A page that asks for a trip the Worker does not know would render
        // nothing at all. Showing everything is the safer wrong answer.
        if (state.only && !cat.trips[state.only]) state.only = null;

        renderTrips();

        var g = $("#bkguests");
        for (var i = 1; i <= cat.maxGuests; i++) {
          var o = document.createElement("option");
          o.value = String(i);
          o.textContent = t(i === 1 ? "ui.guest1" : "ui.guestN", { n: i });
          g.appendChild(o);
        }
        g.value = String(Math.min(2, cat.maxGuests));

        renderCountryCodes();

        // The picker can render with just EUR immediately; refreshPrices()
        // upgrades every price on screen in place once the real rates land,
        // whether that is instant (cached) or a moment behind (first fetch).
        renderCurrencyPicker();
        if (window.CHIFBAY_FX) {
          window.CHIFBAY_FX.ready.then(function () {
            renderCurrencyPicker();
            refreshPrices();
          });
        }

        $("#bkloading").hidden = true;
        $("#bkflow").hidden = false;

        // ?v=cabo-girao — came from a "Book 2h" button, so skip the picker.
        var want = /[?&]v=([a-z0-9-]+)/i.exec(location.search);
        if (want) {
          var hit = offers().filter(function (o2) { return o2.varId === want[1].toLowerCase(); })[0];
          if (hit) select(hit.tripId, hit.varId);
        }
      })
      .catch(function () {
        $("#bkloading").innerHTML =
          "<p>" + esc(t("ui.notReachable")).replace(
            esc(t("ui.whatsapp")),
            '<a href="' + CFG.WA + '">' + esc(t("ui.whatsapp")) + "</a>") + "</p>";
      });

    $("#bkto3").addEventListener("click", function () {
      renderSummary();
      step(3);
    });
    $$("[data-back]").forEach(function (b) {
      b.addEventListener("click", function () { step(Number(b.dataset.back)); });
    });
    $("#bkform").addEventListener("submit", startPayment);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
