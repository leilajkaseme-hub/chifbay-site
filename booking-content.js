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

    // One-line description per option. Overrides the blurb the Worker sends,
    // so wording changes never touch the payment Worker.
    "blurb.day-trip/ribeira-brava":
      "C\u00e2mara de Lobos, the drone at Cabo Gir\u00e3o, swim and paddle at Faj\u00e3 dos Padres.",
    "blurb.day-trip/ponta-do-sol":
      "The long day trip: everything in To Ribeira Brava, then 30 minutes further west to Ponta do Sol.",
    "blurb.sunset/cabo-girao":
      "The west coast as the light turns, drinks and food on deck, the drone at Cabo Gir\u00e3o.",
    "blurb.sunset/ribeira-brava":
      "The longer run, out past Cabo Gir\u00e3o to Ribeira Brava and back into a lit-up Funchal.",

    // what you actually do, per option
    "hl.day-trip/ribeira-brava": [
      "Swim, jump in and paddle at Fajã dos Padres",
      "Insta360 360° video, drone footage (weather allowing) and camera photos",
      "Drinks and food served on board",
    ],
    "hl.day-trip/ponta-do-sol": [
      "Everything in the To Ribeira Brava trip, then 30 minutes further west",
      "Insta360 360° video, drone footage (weather allowing) and camera photos",
      "Ponta do Sol, the furthest west we run",
    ],
    "hl.sunset/cabo-girao": [
      "Evening light under 580 metres of cliff",
      "Drinks and food served on deck, engine off",
      "Insta360 360° video, drone footage (weather allowing) and camera photos",
      "Open-throttle run back into a lit-up Funchal",
    ],
    "hl.sunset/ribeira-brava": [
      "Everything in the To Cabo Girão trip",
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
    "ui.backBy":      "back",
    "ui.onTheWater":  "on the water",
    "ui.hourOne":     "{n} hour",
    "ui.hourMany":    "{n} hours",
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
    "ui.retry":       "Try again",
    "ui.whatsapp":    "message us on WhatsApp",
    "ui.hoursShort":  "h",
    "ui.minsShort":   "min",
    "ui.currency":    "Show prices in",
    "ui.dayClosed":   "That day is not open for booking. The calendar has been refreshed.",
    "ui.monthEmpty": "No free day this month.",
    "ui.proof": "{r} from {n} verified reviews on Google, GetYourGuide and Tripadvisor",
    "ui.lastFree": "Bookings open up to {n} days ahead. Last free day:",
    "ui.nextFree": "Next free day:",
    "ui.noneFree": "No free date in the booking window right now. Please message us on WhatsApp and we will look for one.",
    "ui.taken": "That day is already booked. The closest free days:",
    "ui.sunsetAt": "Sunset that day: {t}.",
    "ui.sunsetBefore": "The sun is already down when you leave, so this is an evening run under the lights of Funchal.",
    "ui.sunsetDuring": "The sun sets during your trip.",
    "ui.sunsetAfter": "The sun sets after you are back, so you sail in the late afternoon light.",
    "ui.sunsetRule": "leaves 1 h 15 before sunset, so the light is right all year",
    "ui.sunsetToday": "today {t}, back {b}",
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
      "ui.currency":  "Afficher les prix en",
      "ui.dayClosed": "Cette date n'est pas ouverte à la réservation. Le calendrier a été mis à jour.",
      "ui.sunsetAt": "Coucher du soleil ce jour-là : {t}.",
      "ui.sunsetBefore": "Le soleil est déjà couché au départ : c'est une sortie du soir sous les lumières de Funchal.",
      "ui.sunsetDuring": "Le soleil se couche pendant votre sortie.",
      "ui.sunsetAfter": "Le soleil se couche après votre retour : vous naviguez dans la lumière de fin d'après-midi.",
      "ui.sunsetRule": "part 1 h 15 avant le coucher du soleil, pour une belle lumière toute l'année",
      "ui.sunsetToday": "aujourd'hui {t}, retour {b}",
      "ui.monthEmpty": "Aucun jour libre ce mois-ci.",
      "ui.proof": "{r} sur {n} avis vérifiés sur Google, GetYourGuide et Tripadvisor",
      "ui.lastFree": "On réserve jusqu'à {n} jours à l'avance. Dernier jour libre :",
      "ui.nextFree": "Prochain jour libre :",
      "ui.noneFree": "Aucune date libre pour le moment. Écrivez-nous sur WhatsApp et nous en chercherons une.",
      "ui.taken": "Ce jour est déjà réservé. Les jours libres les plus proches :",
      "ui.whatsapp": "WhatsApp",
      "ui.calFailed": "Impossible de charger le calendrier. Écrivez-nous sur WhatsApp.",
      "ui.retry": "Réessayer",
      // what you do, per option (English source: EN "hl.*")
      "hl.day-trip/ribeira-brava": ["Baignade, saut et paddle à la Fajã dos Padres", "Vidéo 360° Insta360, images de drone (si la météo le permet) et photos à l'appareil", "Boissons et repas servis à bord"],
      "hl.day-trip/ponta-do-sol": ["Tout le parcours jusqu'à Ribeira Brava, puis 30 minutes plus à l'ouest", "Vidéo 360° Insta360, images de drone (si la météo le permet) et photos à l'appareil", "Ponta do Sol, le point le plus à l'ouest"],
      "hl.sunset/cabo-girao": ["La lumière du soir sous 580 mètres de falaise", "Boissons et repas servis sur le pont, moteur coupé", "Vidéo 360° Insta360, images de drone (si la météo le permet) et photos à l'appareil", "Retour plein gaz vers Funchal illuminée"],
      "hl.sunset/ribeira-brava": ["Tout le parcours jusqu'au Cabo Girão", "Plus loin, après la Fajã dos Padres, jusqu'à Ribeira Brava", "Trente minutes de plus dans la plus belle lumière du jour"],
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
      "ui.currency":  "Preise anzeigen in",
      "ui.dayClosed": "Dieser Tag ist nicht buchbar. Der Kalender wurde aktualisiert.",
      "ui.sunsetAt": "Sonnenuntergang an diesem Tag: {t}.",
      "ui.sunsetBefore": "Die Sonne ist bei der Abfahrt schon untergegangen: eine Abendfahrt unter den Lichtern von Funchal.",
      "ui.sunsetDuring": "Die Sonne geht während Ihrer Fahrt unter.",
      "ui.sunsetAfter": "Die Sonne geht erst nach Ihrer Rückkehr unter: Sie fahren im Licht des späten Nachmittags.",
      "ui.sunsetRule": "legt 1 Std. 15 Min. vor Sonnenuntergang ab, damit das Licht das ganze Jahr stimmt",
      "ui.sunsetToday": "heute {t}, zurück {b}",
      "ui.monthEmpty": "Kein freier Tag in diesem Monat.",
      "ui.proof": "{r} aus {n} verifizierten Bewertungen auf Google, GetYourGuide und Tripadvisor",
      "ui.lastFree": "Buchbar bis {n} Tage im Voraus. Letzter freier Tag:",
      "ui.nextFree": "Nächster freier Tag:",
      "ui.noneFree": "Gerade kein freies Datum. Schreiben Sie uns auf WhatsApp, wir suchen eines.",
      "ui.taken": "Dieser Tag ist schon gebucht. Die nächsten freien Tage:",
      "ui.whatsapp": "WhatsApp",
      "ui.calFailed": "Der Kalender konnte nicht geladen werden. Schreiben Sie uns auf WhatsApp.",
      "ui.retry": "Erneut versuchen",
      // what you do, per option (English source: EN "hl.*")
      "hl.day-trip/ribeira-brava": ["Baden, Springen und Paddeln an der Fajã dos Padres", "Insta360-360°-Video, Drohnenaufnahmen (wenn das Wetter es erlaubt) und Kamerafotos", "Getränke und Essen an Bord"],
      "hl.day-trip/ponta-do-sol": ["Alles aus der Fahrt bis Ribeira Brava, dann 30 Minuten weiter nach Westen", "Insta360-360°-Video, Drohnenaufnahmen (wenn das Wetter es erlaubt) und Kamerafotos", "Ponta do Sol, unser westlichster Punkt"],
      "hl.sunset/cabo-girao": ["Abendlicht unter 580 Meter hohen Klippen", "Getränke und Essen an Deck, Motor aus", "Insta360-360°-Video, Drohnenaufnahmen (wenn das Wetter es erlaubt) und Kamerafotos", "Mit Vollgas zurück ins beleuchtete Funchal"],
      "hl.sunset/ribeira-brava": ["Alles aus der Fahrt bis Cabo Girão", "Weiter an der Fajã dos Padres vorbei bis Ribeira Brava", "Dreißig Minuten mehr im schönsten Licht des Tages"],
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
      "ui.currency":  "Mostrar preços em",
      "ui.dayClosed": "Esse dia não está disponível para reserva. O calendário foi atualizado.",
      "ui.sunsetAt": "Pôr do sol nesse dia: {t}.",
      "ui.sunsetBefore": "O sol já se pôs à partida: é um passeio ao fim do dia com as luzes do Funchal.",
      "ui.sunsetDuring": "O sol põe-se durante o seu passeio.",
      "ui.sunsetAfter": "O sol põe-se depois do regresso: navega com a luz do fim da tarde.",
      "ui.sunsetRule": "parte 1 h 15 antes do pôr do sol, para a luz estar certa todo o ano",
      "ui.sunsetToday": "hoje {t}, regresso {b}",
      "ui.monthEmpty": "Nenhum dia livre este mês.",
      "ui.proof": "{r} em {n} avaliações verificadas no Google, GetYourGuide e Tripadvisor",
      "ui.lastFree": "Reservas até {n} dias de antecedência. Último dia livre:",
      "ui.nextFree": "Próximo dia livre:",
      "ui.noneFree": "Nenhuma data livre de momento. Escreva-nos no WhatsApp e procuramos uma.",
      "ui.taken": "Esse dia já está reservado. Os dias livres mais próximos:",
      "ui.whatsapp": "WhatsApp",
      "ui.calFailed": "Não foi possível carregar o calendário. Escreva-nos pelo WhatsApp.",
      "ui.retry": "Tentar de novo",
      // what you do, per option (English source: EN "hl.*")
      "hl.day-trip/ribeira-brava": ["Banho, saltos e paddle na Fajã dos Padres", "Vídeo 360° Insta360, imagens de drone (se o tempo permitir) e fotos de câmara", "Bebidas e comida servidas a bordo"],
      "hl.day-trip/ponta-do-sol": ["Tudo do passeio até à Ribeira Brava, e mais 30 minutos para oeste", "Vídeo 360° Insta360, imagens de drone (se o tempo permitir) e fotos de câmara", "Ponta do Sol, o ponto mais a oeste"],
      "hl.sunset/cabo-girao": ["A luz do fim do dia sob 580 metros de falésia", "Bebidas e comida servidas no convés, motor desligado", "Vídeo 360° Insta360, imagens de drone (se o tempo permitir) e fotos de câmara", "Regresso a toda a velocidade até um Funchal iluminado"],
      "hl.sunset/ribeira-brava": ["Tudo do passeio até ao Cabo Girão", "Mais além da Fajã dos Padres, até à Ribeira Brava", "Mais trinta minutos na melhor luz do dia"],
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
      "ui.currency":  "Mostrar precios en",
      "ui.dayClosed": "Ese día no está disponible para reservar. El calendario se ha actualizado.",
      "ui.sunsetAt": "Puesta de sol ese día: {t}.",
      "ui.sunsetBefore": "El sol ya se ha puesto a la salida: es un paseo nocturno bajo las luces de Funchal.",
      "ui.sunsetDuring": "El sol se pone durante tu salida.",
      "ui.sunsetAfter": "El sol se pone después de volver: navegas con la luz del final de la tarde.",
      "ui.sunsetRule": "sale 1 h 15 antes de la puesta de sol, para tener la buena luz todo el año",
      "ui.sunsetToday": "hoy {t}, vuelta {b}",
      "ui.monthEmpty": "Ningún día libre este mes.",
      "ui.proof": "{r} de {n} opiniones verificadas en Google, GetYourGuide y Tripadvisor",
      "ui.lastFree": "Se reserva hasta {n} días antes. Último día libre:",
      "ui.nextFree": "Próximo día libre:",
      "ui.noneFree": "Ahora no hay fechas libres. Escríbenos por WhatsApp y buscamos una.",
      "ui.taken": "Ese día ya está reservado. Los días libres más cercanos:",
      "ui.whatsapp": "WhatsApp",
      "ui.calFailed": "No se pudo cargar el calendario. Escríbenos por WhatsApp.",
      "ui.retry": "Reintentar",
      // what you do, per option (English source: EN "hl.*")
      "hl.day-trip/ribeira-brava": ["Baño, saltos y paddle en Fajã dos Padres", "Vídeo 360° Insta360, imágenes de dron (si el tiempo lo permite) y fotos con cámara", "Bebidas y comida servidas a bordo"],
      "hl.day-trip/ponta-do-sol": ["Todo lo de la salida hasta Ribeira Brava, y 30 minutos más al oeste", "Vídeo 360° Insta360, imágenes de dron (si el tiempo lo permite) y fotos con cámara", "Ponta do Sol, el punto más al oeste"],
      "hl.sunset/cabo-girao": ["La luz de la tarde bajo 580 metros de acantilado", "Bebidas y comida en cubierta, motor apagado", "Vídeo 360° Insta360, imágenes de dron (si el tiempo lo permite) y fotos con cámara", "Vuelta a todo gas hacia un Funchal iluminado"],
      "hl.sunset/ribeira-brava": ["Todo lo de la salida hasta Cabo Girão", "Más allá de Fajã dos Padres, hasta Ribeira Brava", "Treinta minutos más con la mejor luz del día"],
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
      "ui.currency":  "Mostra i prezzi in",
      "ui.dayClosed": "Quel giorno non è prenotabile. Il calendario è stato aggiornato.",
      "ui.sunsetAt": "Tramonto quel giorno: {t}.",
      "ui.sunsetBefore": "Il sole è già tramontato alla partenza: è un giro serale sotto le luci di Funchal.",
      "ui.sunsetDuring": "Il sole tramonta durante la tua uscita.",
      "ui.sunsetAfter": "Il sole tramonta dopo il rientro: navighi nella luce del tardo pomeriggio.",
      "ui.sunsetRule": "parte 1 h 15 prima del tramonto, così la luce è giusta tutto l'anno",
      "ui.sunsetToday": "oggi {t}, rientro {b}",
      "ui.monthEmpty": "Nessun giorno libero questo mese.",
      "ui.proof": "{r} su {n} recensioni verificate su Google, GetYourGuide e Tripadvisor",
      "ui.lastFree": "Si prenota fino a {n} giorni prima. Ultimo giorno libero:",
      "ui.nextFree": "Prossimo giorno libero:",
      "ui.noneFree": "Al momento nessuna data libera. Scriveteci su WhatsApp e ne cerchiamo una.",
      "ui.taken": "Quel giorno è già prenotato. I giorni liberi più vicini:",
      "ui.whatsapp": "WhatsApp",
      "ui.calFailed": "Impossibile caricare il calendario. Scrivici su WhatsApp.",
      "ui.retry": "Riprova",
      // what you do, per option (English source: EN "hl.*")
      "hl.day-trip/ribeira-brava": ["Bagno, tuffi e paddle alla Fajã dos Padres", "Video 360° Insta360, riprese con drone (meteo permettendo) e foto con fotocamera", "Bevande e cibo serviti a bordo"],
      "hl.day-trip/ponta-do-sol": ["Tutto il percorso fino a Ribeira Brava, poi 30 minuti più a ovest", "Video 360° Insta360, riprese con drone (meteo permettendo) e foto con fotocamera", "Ponta do Sol, il punto più a ovest"],
      "hl.sunset/cabo-girao": ["La luce della sera sotto 580 metri di falesia", "Bevande e cibo in coperta, motore spento", "Video 360° Insta360, riprese con drone (meteo permettendo) e foto con fotocamera", "Rientro a tutto gas verso Funchal illuminata"],
      "hl.sunset/ribeira-brava": ["Tutto il percorso fino a Cabo Girão", "Oltre la Fajã dos Padres, fino a Ribeira Brava", "Trenta minuti in più nella luce più bella del giorno"],
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
