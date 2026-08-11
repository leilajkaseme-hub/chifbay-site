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
  // `icon` keys into ICON_PATHS in booking.js — the same gold line-icon set
  // already used on the tour pages' itinerary timeline (peak.css, data-ic).
  // Câmara de Lobos is a working fishing harbour (fisher), Cabo Girão is the
  // sheer 580 m cliff face (cliff — the drone is what FLIES there, the cliff
  // is what makes the place; the itinerary timeline uses "drone" for the
  // same spot, so this map reads as the cliff you see on the way TO the
  // drone shot rather than repeating the same glyph).
  var STOPS = [
    { id: "funchal",  name: "Funchal",           km: 0,    icon: "anchor" },
    { id: "camara",   name: "Câmara de Lobos",   km: 6,    icon: "fisher" },
    { id: "girao",    name: "Cabo Girão",        km: 9,    icon: "cliff" },
    { id: "faja",     name: "Fajã dos Padres",   km: 11.5, icon: "cove" },
    { id: "brava",    name: "Ribeira Brava",     km: 14,   icon: "boat" },
    { id: "sol",      name: "Ponta do Sol",      km: 17.5, icon: "sun" },
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

  /* [iso2, dial code]. Flags are generated FROM the iso2 at render time
     (two regional-indicator codepoints = iso2 letters + 0x1F1E6-'A') rather
     than typed by hand — 190 hand-typed emoji is how one gets it wrong.
     Sorted by dial code within each block only for readability here; the UI
     sorts the actual list by country name. */
  var DIAL_CODES = [
    ["PT","351"],["GB","44"],["FR","33"],["DE","49"],["ES","34"],["IT","39"],
    ["US","1"],["CA","1"],["IE","353"],["NL","31"],["BE","32"],["CH","41"],
    ["AT","43"],["LU","352"],["MC","377"],["AD","376"],["SE","46"],["NO","47"],
    ["DK","45"],["FI","358"],["IS","354"],["PL","48"],["CZ","420"],["SK","421"],
    ["HU","36"],["RO","40"],["BG","359"],["GR","30"],["CY","357"],["MT","356"],
    ["HR","385"],["SI","386"],["RS","381"],["BA","387"],["ME","382"],["MK","389"],
    ["AL","355"],["XK","383"],["EE","372"],["LV","371"],["LT","370"],["UA","380"],
    ["BY","375"],["MD","373"],["RU","7"],["TR","90"],["IL","972"],["AE","971"],
    ["SA","966"],["QA","974"],["KW","965"],["BH","973"],["OM","968"],["JO","962"],
    ["LB","961"],["EG","20"],["MA","212"],["DZ","213"],["TN","216"],["LY","218"],
    ["ZA","27"],["NG","234"],["KE","254"],["GH","233"],["ET","251"],["TZ","255"],
    ["UG","256"],["CI","225"],["SN","221"],["CM","237"],["ZW","263"],["ZM","260"],
    ["MZ","258"],["AO","244"],["CV","238"],["NA","264"],["BW","267"],["RW","250"],
    ["IN","91"],["PK","92"],["BD","880"],["LK","94"],["NP","977"],["CN","86"],
    ["JP","81"],["KR","82"],["HK","852"],["MO","853"],["TW","886"],["SG","65"],
    ["MY","60"],["TH","66"],["VN","84"],["PH","63"],["ID","62"],["KH","855"],
    ["LA","856"],["MM","95"],["MN","976"],["KZ","7"],["UZ","998"],["AU","61"],
    ["NZ","64"],["FJ","679"],["PG","675"],["BR","55"],["AR","54"],["CL","56"],
    ["CO","57"],["PE","51"],["VE","58"],["EC","593"],["BO","591"],["PY","595"],
    ["UY","598"],["GY","592"],["SR","597"],["MX","52"],["GT","502"],["BZ","501"],
    ["SV","503"],["HN","504"],["NI","505"],["CR","506"],["PA","507"],["CU","53"],
    ["DO","1"],["HT","509"],["JM","1"],["TT","1"],["BB","1"],["BS","1"],
    ["IS","354"],["IQ","964"],["IR","98"],["AF","93"],["SY","963"],["YE","967"],
    ["GE","995"],["AM","374"],["AZ","994"],["KG","996"],["TJ","992"],["TM","993"],
  ];

  var seenIso = {};
  var DIAL_UNIQUE = DIAL_CODES.filter(function (r) {
    if (seenIso[r[0]]) return false;
    seenIso[r[0]] = 1;
    return true;
  });

  function flagOf(iso2) {
    if (!iso2 || iso2.length !== 2) return "";
    var A = 0x1f1e6, base = "A".charCodeAt(0);
    return String.fromCodePoint(A + (iso2.charCodeAt(0) - base)) +
           String.fromCodePoint(A + (iso2.charCodeAt(1) - base));
  }

  // English names, used for sort order and for the visible+searchable option
  // text — a phone country picker is understood everywhere by its flag and
  // its code, so this is the one part of the booking flow deliberately not
  // translated into the other five languages.
  var COUNTRY_NAME = {
    PT:"Portugal",GB:"United Kingdom",FR:"France",DE:"Germany",ES:"Spain",IT:"Italy",
    US:"United States",CA:"Canada",IE:"Ireland",NL:"Netherlands",BE:"Belgium",CH:"Switzerland",
    AT:"Austria",LU:"Luxembourg",MC:"Monaco",AD:"Andorra",SE:"Sweden",NO:"Norway",
    DK:"Denmark",FI:"Finland",IS:"Iceland",PL:"Poland",CZ:"Czechia",SK:"Slovakia",
    HU:"Hungary",RO:"Romania",BG:"Bulgaria",GR:"Greece",CY:"Cyprus",MT:"Malta",
    HR:"Croatia",SI:"Slovenia",RS:"Serbia",BA:"Bosnia and Herzegovina",ME:"Montenegro",MK:"North Macedonia",
    AL:"Albania",XK:"Kosovo",EE:"Estonia",LV:"Latvia",LT:"Lithuania",UA:"Ukraine",
    BY:"Belarus",MD:"Moldova",RU:"Russia",TR:"Türkiye",IL:"Israel",AE:"United Arab Emirates",
    SA:"Saudi Arabia",QA:"Qatar",KW:"Kuwait",BH:"Bahrain",OM:"Oman",JO:"Jordan",
    LB:"Lebanon",EG:"Egypt",MA:"Morocco",DZ:"Algeria",TN:"Tunisia",LY:"Libya",
    ZA:"South Africa",NG:"Nigeria",KE:"Kenya",GH:"Ghana",ET:"Ethiopia",TZ:"Tanzania",
    UG:"Uganda",CI:"Côte d'Ivoire",SN:"Senegal",CM:"Cameroon",ZW:"Zimbabwe",ZM:"Zambia",
    MZ:"Mozambique",AO:"Angola",CV:"Cabo Verde",NA:"Namibia",BW:"Botswana",RW:"Rwanda",
    IN:"India",PK:"Pakistan",BD:"Bangladesh",LK:"Sri Lanka",NP:"Nepal",CN:"China",
    JP:"Japan",KR:"South Korea",HK:"Hong Kong",MO:"Macao",TW:"Taiwan",SG:"Singapore",
    MY:"Malaysia",TH:"Thailand",VN:"Vietnam",PH:"Philippines",ID:"Indonesia",KH:"Cambodia",
    LA:"Laos",MM:"Myanmar",MN:"Mongolia",KZ:"Kazakhstan",UZ:"Uzbekistan",AU:"Australia",
    NZ:"New Zealand",FJ:"Fiji",PG:"Papua New Guinea",BR:"Brazil",AR:"Argentina",CL:"Chile",
    CO:"Colombia",PE:"Peru",VE:"Venezuela",EC:"Ecuador",BO:"Bolivia",PY:"Paraguay",
    UY:"Uruguay",GY:"Guyana",SR:"Suriname",MX:"Mexico",GT:"Guatemala",BZ:"Belize",
    SV:"El Salvador",HN:"Honduras",NI:"Nicaragua",CR:"Costa Rica",PA:"Panama",CU:"Cuba",
    DO:"Dominican Republic",HT:"Haiti",JM:"Jamaica",TT:"Trinidad and Tobago",BB:"Barbados",BS:"Bahamas",
    IQ:"Iraq",IR:"Iran",AF:"Afghanistan",SY:"Syria",YE:"Yemen",
    GE:"Georgia",AM:"Armenia",AZ:"Azerbaijan",KG:"Kyrgyzstan",TJ:"Tajikistan",TM:"Turkmenistan",
  };

  function dialList() {
    return DIAL_UNIQUE.map(function (r) {
      return { iso2: r[0], dial: r[1], flag: flagOf(r[0]), name: COUNTRY_NAME[r[0]] || r[0] };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  /* Best guess at the visitor's own country, so their phone field opens on
     their real dial code instead of always defaulting to Portugal.
     navigator.language carries a region ("en-US" -> "US") on real browsers;
     Portugal is the fallback because that is where the boat actually is. */
  function guessCountry() {
    try {
      var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
      for (var i = 0; i < langs.length; i++) {
        var m = /-([A-Za-z]{2})$/.exec(langs[i] || "");
        if (m && COUNTRY_NAME[m[1].toUpperCase()]) return m[1].toUpperCase();
      }
    } catch (e) { /* navigator.languages can be unavailable in odd embeds */ }
    return "PT";
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
    dialCodes: dialList,
    guessCountry: guessCountry,
  };
})();
