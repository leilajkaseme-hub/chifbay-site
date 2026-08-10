/*! Chifbay — the booking side (book.chifbay.com, Wix Bookings).
 *
 *  Reports the finished booking to GA4, Google Ads and Meta.
 *  Loaded from chifbay.com so the Wix custom-code box only ever holds two
 *  <script> lines: every change after this is a git push, not a Wix login.
 *
 *  Runs next to track.js, which does the rest (tags, consent, the ad click id)
 *  and hands the ids over on window.cbCfg. Nothing is configured here.
 */
(function () {
  "use strict";

  // Money value per tour, so the purchase reports a real amount and not zero.
  var TOURS = {
    "private-sunset-cruise":            { value: 400, name: "Sunset Trip" },
    "private-luxury-boat-tour-madeira": { value: 500, name: "Day Trip" }
  };

  function cookie(name) {
    var m = document.cookie.match("(^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[2]) : null;
  }

  function tour() {
    var where = location.pathname + location.search + document.referrer;
    for (var slug in TOURS) if (where.indexOf(slug) !== -1) return TOURS[slug];
    return { value: undefined, name: "Boat tour" };
  }

  // Wix confirms a booking on a page whose path or query says so. Both forms
  // appear depending on how the calendar was reached, so match either.
  function isConfirmation() {
    var p = location.pathname.toLowerCase();
    var q = location.search.toLowerCase();
    return p.indexOf("booking-confirmation") !== -1 ||
           p.indexOf("thank-you") !== -1 ||
           p.indexOf("/confirmation") !== -1 ||
           q.indexOf("bookingid=") !== -1;
  }

  // Only once per booking, even if the guest refreshes the confirmation page.
  function alreadyCounted(key) {
    try {
      if (sessionStorage.getItem(key)) return true;
      sessionStorage.setItem(key, "1");
      return false;
    } catch (e) { return false; }
  }

  function report() {
    if (!isConfirmation()) return;

    var id = (new URLSearchParams(location.search).get("bookingId")) || location.pathname;
    if (alreadyCounted("cb_purchase_" + id)) return;

    var t = tour();
    var attr = {};
    try { attr = JSON.parse(cookie("cb_attr") || "{}"); } catch (e) {}

    var cfg = window.cbCfg || {};

    if (window.gtag) {
      gtag("event", "purchase", {
        transaction_id: id,
        value: t.value,
        currency: "EUR",
        items: [{ item_name: t.name, price: t.value, quantity: 1 }],
        campaign: attr.utm_campaign,
        source: attr.utm_source
      });

      // The Google Ads "Achat" conversion. Needs its own event with send_to —
      // a plain GA4 purchase does not reach Google Ads by itself.
      if (cfg.googleAdsId && cfg.adsPurchaseLabel) {
        gtag("event", "conversion", {
          send_to: cfg.googleAdsId + "/" + cfg.adsPurchaseLabel,
          transaction_id: id,
          value: t.value,
          currency: "EUR"
        });
      }
    }
    if (window.fbq) {
      fbq("track", "Purchase", { value: t.value, currency: "EUR", content_name: t.name });
    }
  }

  // track.js loads with defer, so gtag/fbq are not ready at parse time.
  function wait(tries) {
    if (window.gtag || window.fbq) return report();
    if (tries > 0) setTimeout(function () { wait(tries - 1); }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { wait(25); });
  } else {
    wait(25);
  }

  // Wix swaps pages without a reload, so a plain load handler would miss the
  // confirmation screen.
  var lastPath = location.pathname + location.search;
  setInterval(function () {
    var now = location.pathname + location.search;
    if (now !== lastPath) { lastPath = now; report(); }
  }, 700);
})();
