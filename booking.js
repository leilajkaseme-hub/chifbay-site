/* Chifbay on-site booking.
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
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var state = {
    catalogue: null,
    trip: null,
    variant: null,
    date: null,
    time: null,
    availability: {},
    month: null,       // first day of the month being shown, as YYYY-MM-01
    checkout: null,    // the mounted Stripe embedded checkout
  };

  /* ------------------------------------------------------------ small utils */

  function money(cents) {
    return "€" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
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

  function longDate(s) {
    var d = parseYmd(s);
    return d.toLocaleDateString(document.documentElement.lang || "en", {
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

  /* ------------------------------------------------------------ step 1 trip */

  function renderTrips() {
    var wrap = $("#bktrips");
    wrap.innerHTML = "";
    Object.keys(state.catalogue.trips).forEach(function (tripId) {
      var trip = state.catalogue.trips[tripId];
      Object.keys(trip.variants).forEach(function (varId) {
        var v = trip.variants[varId];
        var card = document.createElement("button");
        card.type = "button";
        card.className = "bkcard";
        card.dataset.trip = tripId;
        card.dataset.variant = varId;
        card.innerHTML =
          '<span class="bkck">' + trip.name + "</span>" +
          "<h3>" + v.name + "</h3>" +
          "<p>" + v.blurb + "</p>" +
          '<span class="bkmeta">' +
            (v.minutes >= 60 ? Math.floor(v.minutes / 60) + " h" : "") +
            (v.minutes % 60 ? " " + (v.minutes % 60) + " min" : "") +
            " · departs " + trip.times.join(" or ") +
          "</span>" +
          '<span class="bkprice">' + money(v.amount) + '<em>whole boat</em></span>';
        card.addEventListener("click", function () {
          state.trip = tripId;
          state.variant = varId;
          state.date = null;
          state.time = null;
          $$(".bkcard").forEach(function (c) { c.classList.remove("sel"); });
          card.classList.add("sel");
          loadAvailability();
          step(2);
        });
        wrap.appendChild(card);
      });
    });
  }

  /* ------------------------------------------------------- step 2 date/time */

  function loadAvailability() {
    var today = new Date();
    var from = ymd(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    var to = addDays(from, CFG.DAYS_AHEAD);
    state.month = from.slice(0, 8) + "01";
    $("#bkcal").innerHTML = '<p class="bkload">Checking the calendar…</p>';
    api("/v1/availability?trip=" + encodeURIComponent(state.trip) +
        "&variant=" + encodeURIComponent(state.variant) +
        "&from=" + from + "&to=" + to)
      .then(function (res) {
        state.availability = res.days || {};
        renderCalendar();
      })
      .catch(function (e) {
        $("#bkcal").innerHTML = '<p class="bkload">Could not load the calendar. ' +
          'Please <a href="https://wa.me/351937200320">message us on WhatsApp</a>.</p>';
        say(e.message, "err");
      });
  }

  function renderCalendar() {
    var wrap = $("#bkcal");
    var first = parseYmd(state.month);
    var y = first.getUTCFullYear(), m = first.getUTCMonth();
    var monthName = first.toLocaleDateString(document.documentElement.lang || "en",
      { month: "long", year: "numeric", timeZone: "UTC" });

    // Monday-first grid.
    var lead = (first.getUTCDay() + 6) % 7;
    var daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    var html = '<div class="bkcalhead">' +
      '<button type="button" class="bknav" data-dir="-1" aria-label="Previous month">‹</button>' +
      "<strong>" + monthName + "</strong>" +
      '<button type="button" class="bknav" data-dir="1" aria-label="Next month">›</button>' +
      "</div><div class=\"bkgrid\">";
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) {
      html += '<span class="bkdow">' + d + "</span>";
    });
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
      box.innerHTML = '<p class="bkhint">Pick a day with a dot to see departure times.</p>';
      $("#bkto3").disabled = true;
      return;
    }
    var times = state.availability[state.date] || [];
    var html = "<p class=\"bkhint\">" + longDate(state.date) +
      " — all times are Funchal time.</p><div class=\"bktimerow\">";
    times.forEach(function (t) {
      html += '<button type="button" class="bktime' + (state.time === t ? " sel" : "") +
        '" data-time="' + t + '">' + t + "</button>";
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
      "<strong>" + trip.name + " — " + v.name + "</strong>" +
      "<span>" + longDate(state.date) + " at " + state.time + " (Funchal time)</span>" +
      "<span>Whole boat, up to " + state.catalogue.maxGuests + " guests</span>" +
      '<span class="bksumprice">' + money(v.amount) + "</span>";
  }

  function startPayment(e) {
    e.preventDefault();
    say("");
    var btn = $("#bkpay");
    btn.disabled = true;
    btn.textContent = "Holding your slot…";

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
        step(4);
        return Stripe(CFG.PK).initEmbeddedCheckout({ clientSecret: res.clientSecret });
      })
      .then(function (checkout) {
        state.checkout = checkout;
        checkout.mount("#bkstripe");
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Pay and confirm";
        step(3);
        say(err.message, "err");
        // If the slot went while they were typing, refresh the calendar.
        if (/taken/i.test(err.message)) loadAvailability();
      });
  }

  /* -------------------------------------------------------------- start up */

  function init() {
    var root = $("#bkbox");
    if (!root) return;

    api("/v1/catalogue")
      .then(function (cat) {
        state.catalogue = cat;
        renderTrips();
        var g = $("#bkguests");
        for (var i = 1; i <= cat.maxGuests; i++) {
          var o = document.createElement("option");
          o.value = String(i);
          o.textContent = i + (i === 1 ? " guest" : " guests");
          g.appendChild(o);
        }
        g.value = "2";
        $("#bkloading").hidden = true;
        $("#bkflow").hidden = false;
      })
      .catch(function () {
        $("#bkloading").innerHTML =
          "<p>The booking system is not reachable right now. " +
          'Please <a href="https://wa.me/351937200320">message us on WhatsApp</a> ' +
          "and we will hold your date.</p>";
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
