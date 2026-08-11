/* Chifbay booking — the selling copy, the photos and the route map data.
 *
 * Why this file exists, and what must NOT go in it:
 *
 *   The Worker's catalog.js is the ONLY place that decides money, duration and
 *   departure times. This file never repeats a price or a time. It holds the
 *   things a price list should not hold: which photo to show, which stops the
 *   boat passes, and the words that make someone want to go.
 *
 *   So: change a price -> catalog.js. Change a photo or a sentence -> here.
 *
 * Keys are "<tripId>/<variantId>", exactly as they come from /v1/catalogue.
 * An unknown key simply renders without a photo or a map. It never breaks.
 */
window.CHIFBAY_CONTENT = (function () {
  "use strict";

  /* Every place the boat passes, west of Funchal, in order.
     `km` is the real distance from Marina do Funchal by sea. The map is drawn
     from these numbers, so the spacing on screen matches the real coast. */
  var STOPS = [
    { id: "funchal",  name: "Funchal",           km: 0 },
    { id: "camara",   name: "Câmara de Lobos",   km: 6 },
    { id: "girao",    name: "Cabo Girão",        km: 9 },
    { id: "faja",     name: "Fajã dos Padres",   km: 11.5 },
    { id: "brava",    name: "Ribeira Brava",     km: 14 },
    { id: "sol",      name: "Ponta do Sol",      km: 17.5 },
  ];

  var VARIANTS = {
    "day-trip/ribeira-brava": {
      photo: "assets/exp-coves.jpg",
      alt: "Turquoise water at Fajã dos Padres on a private Chifbay day trip, Madeira",
      route: ["funchal", "camara", "girao", "faja", "brava"],
    },
    "day-trip/ponta-do-sol": {
      photo: "assets/ponta-do-sol.jpg",
      alt: "The Ponta do Sol coastline from the water, west Madeira",
      route: ["funchal", "camara", "girao", "faja", "brava", "sol"],
    },
    "sunset/cabo-girao": {
      photo: "assets/exp-sunset.jpg",
      alt: "Sunset over the Atlantic from a private Chifbay boat off Cabo Girão",
      route: ["funchal", "camara", "girao"],
    },
    "sunset/ribeira-brava": {
      photo: "assets/g-silhouette.jpg",
      alt: "Silhouette on the bow of a Chifbay boat as the sun drops behind Madeira",
      route: ["funchal", "camara", "girao", "faja", "brava"],
    },
  };

  /* Header photo and words for each page. `all` is the page that sells both. */
  var PAGES = {
    "day-trip": { photo: "assets/exp-coves.jpg" },
    "sunset":   { photo: "assets/exp-sunset.jpg" },
    "all":      { photo: "assets/exp-coastal.jpg" },
  };

  /* ------------------------------------------------------------------ words
     English is the source. A missing key in any other language falls back to
     English, so a half-finished translation can never blank the page out. */
  var EN = {
    // stop captions — the place names themselves are never translated
    "stop.funchal": "Cast off",
    "stop.camara":  "Fishing village",
    "stop.girao":   "580 m cliff · drone",
    "stop.faja":    "Cove with no road in",
    "stop.brava":   "Seafront town",
    "stop.sol":     "Sun-trap village",
    "stop.turn":    "We turn here",

    // what you actually do, per option
    "hl.day-trip/ribeira-brava": [
      "Swim, jump in and paddle at Fajã dos Padres",
      "The drone goes up over Cabo Girão — footage is yours",
      "Drinks and food served on board",
    ],
    "hl.day-trip/ponta-do-sol": [
      "Everything in the 2h30, then 30 minutes further west",
      "A filmed, edited video of your day",
      "Ponta do Sol — the furthest west we run",
    ],
    "hl.sunset/cabo-girao": [
      "Golden hour under 580 metres of cliff",
      "Drinks and food served on deck, engine off",
      "Open-throttle run back into a lit-up Funchal",
    ],
    "hl.sunset/ribeira-brava": [
      "Everything in the 2 hours",
      "On past Fajã dos Padres to Ribeira Brava",
      "Thirty more minutes in the best light of the day",
    ],

    // page headers
    "page.day-trip.kicker": "The Day Trip · Funchal, Madeira",
    "page.day-trip.title":  "The day trip",
    "page.day-trip.sub":    "Câmara de Lobos, the drone at Cabo Girão, then swimming and paddle in water you can see the bottom of. Two lengths — you pick how far west we go.",
    "page.sunset.kicker":   "The Sunset Trip · Funchal, Madeira",
    "page.sunset.title":    "The sunset trip",
    "page.sunset.sub":      "The same west coast taken as the light turns. Drinks and food on deck, the drone over Cabo Girão, and the coast to your group alone.",
    "page.all.kicker":      "Private charter · Funchal, Madeira",
    "page.all.title":       "Book your boat",
    "page.all.sub":         "Four ways to spend it, one flat price for the whole boat. Pick yours, pick a day, pay by card — it takes about two minutes.",

    // the map
    "map.title":   "Where you actually go",
    "map.caption": "Everything is within {km} km west of Funchal — a stretch of coast with 580-metre cliffs, a cove with no road into it, and villages you can only really see from the water.",
    "map.west":    "West",
    "map.home":    "Home port",

    // steps
    "step.1.one":   "Choose your option",
    "step.1.all":   "Choose your trip",
    "step.1.sub":   "The whole boat is yours — never shared with another group.",
    "step.2":       "Pick your day",
    "step.2.sub":   "Days with a dot are open. Every time is Funchal time.",
    "step.3":       "Who is coming?",
    "step.3.sub":   "We only need this to meet you at the marina.",
    "step.4":       "Payment",
    "step.4.sub":   "Your slot is held for 30 minutes while you finish.",

    // controls
    "ui.loading":     "Loading the boat calendar…",
    "ui.checking":    "Checking the calendar…",
    "ui.continue":    "Continue",
    "ui.back":        "Back",
    "ui.change":      "Change option",
    "ui.choose":      "Choose this trip",
    "ui.chosen":      "Chosen",
    "ui.pay":         "Pay and confirm",
    "ui.holding":     "Holding your slot…",
    "ui.pickDay":     "Pick a day with a dot to see departure times.",
    "ui.funchalTime": "all times are Funchal time",
    "ui.wholeBoat":   "whole boat",
    "ui.upTo":        "Whole boat, up to {n} guests",
    "ui.departs":     "departs",
    "ui.or":          "or",
    "ui.from":        "From",
    "ui.duration":    "Duration",
    "ui.guests":      "Guests",
    "ui.upToShort":   "Up to {n}",
    "ui.name":        "Lead guest name",
    "ui.email":       "Email",
    "ui.phone":       "Phone (WhatsApp)",
    "ui.guest1":      "{n} guest",
    "ui.guestN":      "{n} guests",
    "ui.safe":        "Free cancellation up to 24 hours before departure. Your card details go straight to Stripe and are never seen by us or stored on this site.",
    "ui.notReachable": "The booking system is not reachable right now. Please message us on WhatsApp and we will hold your date.",
    "ui.calFailed":   "Could not load the calendar. Please message us on WhatsApp.",
    "ui.whatsapp":    "message us on WhatsApp",
    "ui.hoursShort":  "h",
    "ui.minsShort":   "min",
  };

  var LANGS = {
    fr: {
      "stop.funchal": "Le départ",
      "stop.camara":  "Village de pêcheurs",
      "stop.girao":   "Falaise de 580 m · drone",
      "stop.faja":    "Crique sans route",
      "stop.brava":   "Village en bord de mer",
      "stop.sol":     "Village le plus ensoleillé",
      "stop.turn":    "On fait demi-tour ici",
      "map.title":    "Où vous allez vraiment",
      "map.caption":  "Tout se trouve à moins de {km} km à l'ouest de Funchal — des falaises de 580 mètres, une crique sans route, et des villages qu'on ne voit bien que depuis l'eau.",
      "map.west":     "Ouest",
      "map.home":     "Port d'attache",
      "ui.loading":   "Chargement du calendrier…",
      "ui.continue":  "Continuer",
      "ui.back":      "Retour",
      "ui.pay":       "Payer et confirmer",
    },
    de: {
      "stop.funchal": "Ablegen",
      "stop.camara":  "Fischerdorf",
      "stop.girao":   "580 m Steilküste · Drohne",
      "stop.faja":    "Bucht ohne Straße",
      "stop.brava":   "Ort am Wasser",
      "stop.sol":     "Sonnendorf",
      "stop.turn":    "Hier drehen wir um",
      "map.title":    "Wohin es wirklich geht",
      "map.caption":  "Alles liegt keine {km} km westlich von Funchal — 580 Meter hohe Klippen, eine Bucht ohne Straße und Orte, die man nur vom Wasser aus richtig sieht.",
      "map.west":     "Westen",
      "map.home":     "Heimathafen",
      "ui.loading":   "Bootskalender wird geladen…",
      "ui.continue":  "Weiter",
      "ui.back":      "Zurück",
      "ui.pay":       "Bezahlen und buchen",
    },
    pt: {
      "stop.funchal": "Partida",
      "stop.camara":  "Vila piscatória",
      "stop.girao":   "Falésia de 580 m · drone",
      "stop.faja":    "Enseada sem estrada",
      "stop.brava":   "Vila à beira-mar",
      "stop.sol":     "Vila mais soalheira",
      "stop.turn":    "Viramos aqui",
      "map.title":    "Para onde vai mesmo",
      "map.caption":  "Está tudo a menos de {km} km a oeste do Funchal — falésias de 580 metros, uma enseada sem estrada e vilas que só se veem bem do mar.",
      "map.west":     "Oeste",
      "map.home":     "Porto de origem",
      "ui.loading":   "A carregar o calendário…",
      "ui.continue":  "Continuar",
      "ui.back":      "Voltar",
      "ui.pay":       "Pagar e confirmar",
    },
    es: {
      "stop.funchal": "Salida",
      "stop.camara":  "Pueblo pesquero",
      "stop.girao":   "Acantilado de 580 m · dron",
      "stop.faja":    "Cala sin carretera",
      "stop.brava":   "Pueblo junto al mar",
      "stop.sol":     "El pueblo más soleado",
      "stop.turn":    "Damos la vuelta aquí",
      "map.title":    "Adónde vas de verdad",
      "map.caption":  "Todo está a menos de {km} km al oeste de Funchal — acantilados de 580 metros, una cala sin carretera y pueblos que solo se ven bien desde el agua.",
      "map.west":     "Oeste",
      "map.home":     "Puerto base",
      "ui.loading":   "Cargando el calendario…",
      "ui.continue":  "Continuar",
      "ui.back":      "Volver",
      "ui.pay":       "Pagar y confirmar",
    },
    it: {
      "stop.funchal": "Partenza",
      "stop.camara":  "Borgo di pescatori",
      "stop.girao":   "Falesia di 580 m · drone",
      "stop.faja":    "Cala senza strada",
      "stop.brava":   "Paese sul mare",
      "stop.sol":     "Il paese più soleggiato",
      "stop.turn":    "Qui si torna indietro",
      "map.title":    "Dove si va davvero",
      "map.caption":  "È tutto entro {km} km a ovest di Funchal — falesie di 580 metri, una cala senza strada e paesi che si vedono bene solo dall'acqua.",
      "map.west":     "Ovest",
      "map.home":     "Porto di partenza",
      "ui.loading":   "Caricamento del calendario…",
      "ui.continue":  "Continua",
      "ui.back":      "Indietro",
      "ui.pay":       "Paga e conferma",
    },
  };

  /* Which language to speak. The booking pages are English pages, so this only
     kicks in when a locale page sends the visitor here with ?lang=fr. */
  function pickLang() {
    var q = /[?&]lang=([a-z]{2})/i.exec(location.search);
    var code = q ? q[1].toLowerCase() : (document.documentElement.lang || "en").slice(0, 2);
    return Object.prototype.hasOwnProperty.call(LANGS, code) ? code : "en";
  }

  var lang = pickLang();

  function t(key, vars) {
    var dict = LANGS[lang] || {};
    var s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : EN[key];
    if (s === undefined) return "";
    if (vars && typeof s === "string") {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(vars[k]);
      });
    }
    return s;
  }

  return {
    lang: lang,
    t: t,
    stops: STOPS,
    stop: function (id) {
      for (var i = 0; i < STOPS.length; i++) if (STOPS[i].id === id) return STOPS[i];
      return null;
    },
    variant: function (tripId, varId) { return VARIANTS[tripId + "/" + varId] || null; },
    /* Every stop the trips on THIS page actually reach, in coast order.
       The sunset packs both turn at Ribeira Brava, so a sunset page that drew
       the full stop list was promising Ponta do Sol, which no sunset trip goes
       anywhere near. Pass null on the page that sells everything. */
    stopsFor: function (tripId) {
      var seen = {};
      Object.keys(VARIANTS).forEach(function (key) {
        if (tripId && key.indexOf(tripId + "/") !== 0) return;
        VARIANTS[key].route.forEach(function (id) { seen[id] = 1; });
      });
      return STOPS.filter(function (s) { return seen[s.id]; }).map(function (s) { return s.id; });
    },
    highlights: function (tripId, varId) { return t("hl." + tripId + "/" + varId) || []; },
    page: function (which) { return PAGES[which] || PAGES.all; },
  };
})();
