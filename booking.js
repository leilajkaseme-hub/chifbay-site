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

  function money(cents) {
    return "€" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  }

  function dur(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    return (h ? h + " " + t("ui.hoursShort") : "") + (m ? " " + m : "");
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

  function step(n) {
    $$(".bkstep").forEach(function (el) {
      el.classList.toggle("on", Number(el.dataset.step) === n);
    });
    $$(".bkdot").forEach(function (el) {
      var s = Number(el.dataset.step);
      el.classList.toggle("done", s < n);
      el.classList.toggle("now", s === n);
    });
    var top = $("#bkbox");
    if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
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
  // 17.5 km of coast across 760 units, so the spacing on screen is the real
  // spacing on the water. Funchal sits on the right because the boat runs west.
  var MAP_X0 = 828, MAP_SPAN = 760, MAP_KM = 17.5;
  var MAP_Y = 140;                 // the sea lane the boat runs along
  function mapX(km) { return MAP_X0 - (km / MAP_KM) * MAP_SPAN; }

  /**
   * routeIds — the stops this option visits, or null before anything is picked.
   * With null, the whole coast is drawn and nothing is marked as the turn:
   * "we turn here" would be a lie before the visitor has chosen a length.
   */
  function drawMap(routeIds) {
    var host = $("#bkmap");
    if (!host || !C) return;

    var picked = !!(routeIds && routeIds.length);
    var ids = picked ? routeIds : C.stops.map(function (s) { return s.id; });
    var turn = picked ? ids[ids.length - 1] : null;
    var turnKm = turn && C.stop(turn) ? C.stop(turn).km : MAP_KM;

    // Labels alternate between two rows. Six place names on one row would
    // collide — Fajã dos Padres and Ribeira Brava are only 2.5 km apart.
    var marks = "";
    C.stops.forEach(function (s, i) {
      var on = ids.indexOf(s.id) !== -1;
      var isTurn = s.id === turn;
      var low = i % 2 === 1;                       // second row
      var ny = low ? 62 : 28, cy = low ? 80 : 46;
      marks +=
        '<g class="bkms' + (on ? " on" : "") + (isTurn ? " turn" : "") +
          '" transform="translate(' + mapX(s.km).toFixed(1) + "," + MAP_Y + ')">' +
          (low ? '<line class="bkmtick" x1="0" y1="10" x2="0" y2="46"/>' : "") +
          (isTurn ? '<circle class="bkmring" r="12"/>' : "") +
          '<circle class="bkmdot" r="5.5"/>' +
          '<text class="bkmn" y="' + ny + '">' + esc(s.name) + "</text>" +
          '<text class="bkmc" y="' + cy + '">' +
            esc(isTurn ? t("stop.turn") : t("stop." + s.id)) + "</text>" +
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
      // the mountains behind, then the coastline itself
      '<path class="bkmfar" d="M0,0 H900 V84 L828,74 L760,66 L690,52 L620,60 L560,44 L500,26 L444,10 ' +
        'L400,34 L340,48 L280,26 L220,58 L160,34 L100,50 L40,44 L0,54 Z"/>' +
      '<path class="bkmland" d="M0,0 H900 V96 L828,90 L780,88 L720,80 L660,68 L610,76 L579,82 ' +
        'L530,58 L478,28 L444,18 L414,40 L370,58 L331,66 L292,50 L250,72 L218,82 ' +
        'L172,56 L120,66 L60,78 L0,70 Z"/>' +
      // open water
      '<path class="bkmwave" d="M60,116 q46,-7 92,0 t92,0 t92,0 t92,0 t92,0 t92,0 t92,0 t92,0"/>' +
      // the run west, and how far this option goes
      '<path class="bkmtrack dim" d="M' + mapX(0) + "," + MAP_Y + " H" + mapX(MAP_KM) + '"/>' +
      '<path class="bkmtrack" d="M' + mapX(0) + "," + MAP_Y + " H" + mapX(turnKm).toFixed(1) + '"/>' +
      '<text class="bkmedge" text-anchor="start" x="18" y="' + (MAP_Y - 16) + '">← ' +
        esc(t("map.west")) + "</text>" +
      '<text class="bkmedge" text-anchor="end" x="882" y="' + (MAP_Y - 16) + '">' +
        esc(t("map.home")) + "</text>" +
      marks +
      "</svg>";

    // Below 760px the SVG labels would render at about 6px. The same route is
    // repeated as a plain vertical list and CSS shows one or the other.
    var list = '<ol class="bkrl">';
    C.stops.forEach(function (s) {
      if (ids.indexOf(s.id) === -1) return;
      var isTurn = s.id === turn;
      list += '<li' + (isTurn ? ' class="turn"' : "") + "><b>" + esc(s.name) + "</b><span>" +
        esc(isTurn ? t("stop.turn") : t("stop." + s.id)) + "</span></li>";
    });
    list += "</ol>";

    host.innerHTML = svg + list;
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

  function renderTrips() {
    var wrap = $("#bktrips");
    if (!wrap) return;
    wrap.innerHTML = "";

    offers().forEach(function (o) {
      var c = C && C.variant(o.tripId, o.varId);
      var hls = (C && C.highlights(o.tripId, o.varId)) || [];

      var card = document.createElement("article");
      card.className = "bkcard";
      card.dataset.trip = o.tripId;
      card.dataset.variant = o.varId;

      var pic = c && c.photo
        ? '<div class="bkcpic"><img src="' + esc(c.photo) + '" alt="' + esc(c.alt || o.v.name) +
          '" loading="lazy" decoding="async" width="640" height="360">' +
          '<span class="bkcdur">' + esc(dur(o.v.minutes)) + "</span></div>"
        : "";

      card.innerHTML =
        pic +
        '<div class="bkcbody">' +
          '<span class="bkck">' + esc(o.trip.name) + "</span>" +
          "<h3>" + esc(o.v.name) + "</h3>" +
          "<p>" + esc(o.v.blurb) + "</p>" +
          routeStrip(o.tripId, o.varId) +
          (hls.length
            ? '<ul class="bkcl">' + hls.map(function (h) {
                return '<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
                  esc(h) + "</li>";
              }).join("") + "</ul>"
            : "") +
          '<div class="bkcfoot">' +
            '<span class="bkprice">' + money(o.v.amount) + "<em>" + esc(t("ui.wholeBoat")) + "</em></span>" +
            '<button type="button" class="bkbtn bksm">' + esc(t("ui.choose")) +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
          "</div>" +
          '<span class="bkcmeta">' + esc(t("ui.departs")) + " " +
            esc(o.trip.times.join(" " + t("ui.or") + " ")) + " · " +
            esc(t("ui.upTo", { n: state.catalogue.maxGuests })) + "</span>" +
        "</div>";

      var choose = function () { select(o.tripId, o.varId); };
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

  function renderSummary() {
    var trip = state.catalogue.trips[state.trip];
    var v = trip.variants[state.variant];
    $("#bksum").innerHTML =
      "<strong>" + esc(trip.name + " — " + v.name) + "</strong>" +
      "<span>" + esc(longDate(state.date) + " · " + state.time) + " (" + esc(t("ui.funchalTime")) + ")</span>" +
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
        phone: $("#bkphone").value,
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

  function init() {
    var root = $("#bkbox");
    if (!root) return;

    state.only = root.dataset.trip || null;
    fillWords();

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
