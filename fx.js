/* Chifbay — display-currency estimate for the booking pages.
 *
 * This is DELIBERATELY separate from the money that actually moves. Every
 * price on this site, and the amount Stripe actually charges, stays in EUR
 * — the Worker (booking-api/catalog.js) is the only source of truth for
 * that, unchanged by any of this.
 *
 * What this file adds is a second, clearly-marked number next to the real
 * one: "€400 ≈ $432", built from the European Central Bank's daily
 * reference rate (via the Worker's own /v1/fx, so no browser talks to the
 * ECB directly — see worker.js for why). It exists so a visitor from
 * outside the eurozone has some sense of the price in their own currency
 * before they reach the card step — where Stripe's own Adaptive Pricing
 * takes over and does the REAL, guaranteed, fee-free-to-us conversion at
 * the moment of payment. The estimate here and the real charge Stripe
 * settles on will almost never match to the cent, on purpose: a public
 * daily rate and a live guaranteed one are not the same thing, and this
 * file is written so it can never be mistaken for a quote.
 */
window.CHIFBAY_FX = (function () {
  "use strict";

  var API = window.CHIFBAY_API || "https://chifbay-booking-api.chifandcopt.workers.dev";
  var CHOICE_KEY = "cb-currency";
  var CACHE_KEY = "cb-fx-cache";
  var CACHE_MS = 12 * 3600000; // matches the Worker's own cache window

  // [symbol, decimal places]. Anything ECB ever adds that is missing here
  // falls back to "CODE " + 2 decimals — never breaks, just looks plainer.
  var SYMBOLS = {
    EUR: ["€", 2], USD: ["$", 2], GBP: ["£", 2], JPY: ["¥", 0], CHF: ["CHF", 2],
    CAD: ["C$", 2], AUD: ["A$", 2], NZD: ["NZ$", 2], SEK: ["kr", 2], NOK: ["kr", 2],
    DKK: ["kr", 2], ISK: ["kr", 0], PLN: ["zł", 2], CZK: ["Kč", 2], HUF: ["Ft", 0],
    RON: ["lei", 2], TRY: ["₺", 2], BRL: ["R$", 2], MXN: ["MX$", 2], CNY: ["¥", 2],
    HKD: ["HK$", 2], SGD: ["S$", 2], INR: ["₹", 2], KRW: ["₩", 0], ILS: ["₪", 2],
    ZAR: ["R", 2], THB: ["฿", 2], MYR: ["RM", 2], PHP: ["₱", 2], IDR: ["Rp", 0],
  };

  // Best guess at a visitor's own currency from their browser's region —
  // same technique as the phone country guess, different lookup table.
  var REGION_CURRENCY = {
    US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", CH: "CHF", JP: "JPY",
    CN: "CNY", HK: "HKD", SG: "SGD", IN: "INR", BR: "BRL", MX: "MXN", ZA: "ZAR",
    KR: "KRW", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF",
    RO: "RON", IS: "ISK", TR: "TRY", IL: "ILS", TH: "THB", MY: "MYR", PH: "PHP",
    ID: "IDR",
  };

  var state = { rates: null, asOf: null, code: "EUR" };

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c && c.fetchedAt && Date.now() - c.fetchedAt < CACHE_MS) return c.data;
    } catch (e) { /* private browsing, storage disabled, etc. */ }
    return null;
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data: data })); }
    catch (e) { /* best-effort only */ }
  }

  function guessCode(rates) {
    try {
      var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
      for (var i = 0; i < langs.length; i++) {
        var m = /-([A-Za-z]{2})$/.exec(langs[i] || "");
        var region = m && m[1].toUpperCase();
        var code = region && REGION_CURRENCY[region];
        if (code && rates[code]) return code;
      }
    } catch (e) { /* navigator.languages can be missing in odd embeds */ }
    return "EUR";
  }

  function applyRates(data) {
    state.rates = (data && data.rates) || { EUR: 1 };
    state.asOf = data && data.asOf;
    var chosen = null;
    try { chosen = localStorage.getItem(CHOICE_KEY); } catch (e) {}
    state.code = (chosen && state.rates[chosen]) ? chosen : guessCode(state.rates);
    return state;
  }

  var ready = (function () {
    var cached = readCache();
    if (cached) return Promise.resolve(applyRates(cached));
    return fetch(API + "/v1/fx")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.rates) writeCache(data);
        return applyRates(data);
      })
      .catch(function () { return applyRates({ rates: { EUR: 1 } }); }); // stays EUR-only, never breaks the page
  })();

  function format(eurCents, code) {
    if (!state.rates || !code || code === "EUR") return null;
    var rate = state.rates[code];
    if (!rate) return null;
    var meta = SYMBOLS[code] || [code + " ", 2];
    var val = (eurCents / 100) * rate;
    var parts = val.toFixed(meta[1]).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return meta[0] + parts.join(".");
  }

  return {
    ready: ready,
    get: function () { return state; },
    list: function () {
      return state.rates ? Object.keys(state.rates).sort() : ["EUR"];
    },
    symbol: function (code) { return (SYMBOLS[code] || [code])[0]; },
    set: function (code) {
      state.code = code;
      try { localStorage.setItem(CHOICE_KEY, code); } catch (e) {}
      document.dispatchEvent(new CustomEvent("cb-currency-change"));
    },
    /** "$432" (rounded per that currency's own convention), or null for EUR
     *  itself / a code the rates don't cover. */
    estimate: function (eurCents, code) { return format(eurCents, code || state.code); },
  };
})();
