#!/usr/bin/env node
// add-tide-sections.mjs: the redesigned blocks of the home page and the two
// trip pages, written in all six languages.
//
//   node scripts/add-tide-sections.mjs           dry run
//   node scripts/add-tide-sections.mjs --write   apply
//
// Safe to run again: every block it writes sits between <!-- tide:NAME -->
// markers and is replaced, not added twice.
//
// Home page:
//   - hero framed (class t-frame), the price in it live from the API
//   - "Day or sunset": the two old alternating trip cards become one
//     side by side comparison with the same rows in the same order
//   - "The route": the coast from Funchal to Ponta do Sol, real distances
//   - "The boat": the real drone photo with numbered points
//   - the three small feature cards are folded into "The boat"
//   - the old small route line inside the Cabo Girao band is removed
//     (the new route block replaces it)
//   - light on the water over the closing photo
// Trip pages: framed hero, live prices, the route for that trip, the
// mobile booking bar.
//
// Prices in the HTML are the fallback a crawler reads; tide.js replaces them
// with /v1/catalogue on load. The words never repeat a price on their own.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const LANGS = ["", "fr", "de", "pt", "es", "it"];

/* ------------------------------------------------------------------ words */
const T = {
  en: {
    k: { from: "From", dur: "Duration", dep: "Departs", light: "The light", swim: "Swimming", far: "Furthest point", film: "On film" },
    perBoat: "per boat, up to 5 guests",
    day: { n: "01 · Day", h: "The Day Trip", light: "Midday sun, water you can see the bottom of", swim: "Yes, at Fajã dos Padres. Paddle boards on board", far: "Ribeira Brava, or Ponta do Sol on the 3h", film: "Drone footage. The 3h adds a filmed video", alt: "Drone view of the Chifbay boat at anchor in turquoise water off Madeira" },
    sun: { n: "02 · Sunset", h: "The Sunset Trip", light: "Golden hour, then Funchal lit up on the way back", swim: "No. A cruising trip, drinks and food on deck", far: "Cabo Girão, or Ribeira Brava on the 2h30", film: "Drone footage over Cabo Girão", alt: "A guest on the bow of the Chifbay boat at sunset off Madeira" },
    dates: "Choose a date", see: "See the trip",
    note: "Same boat, same crew, never shared with another group. Every price is for the whole boat. <a href=\"/terms\">Cancellation terms</a>.",
    cmpLabel: "Compare the day trip and the sunset trip",
    route: { k: "The route", h: "One coast, west of Funchal", lead: "Every trip runs the same coastline, out of Marina do Funchal and west under the cliffs. The distances below are real, by sea.", legend: ["<b>Day trip</b> to Ribeira Brava, or on to Ponta do Sol on the 3h", "<b>Sunset</b> to Cabo Girão, or on to Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Meet your skipper on the pontoon, 15 minutes before."],
      camara: ["Câmara de Lobos", "The fishing harbour Churchill painted, seen from the water."],
      girao: ["Cabo Girão", "580 m of cliff straight out of the sea. The drone goes up here."],
      faja: ["Fajã dos Padres", "The cove with no road in. Swim, jump in, paddle. Day trip."],
      brava: ["Ribeira Brava", "Where the 2h30 day trip and the longer sunset turn for home."],
      sol: ["Ponta do Sol", "The far west of the 3h day trip, filmed for you."],
    },
    stopAlt: { funchal: "The pontoon at Marina do Funchal where Chifbay trips start", camara: "The Chifbay boat cruising off Madeira's south coast", girao: "Guests on the Chifbay boat under the sea cliffs", faja: "A guest swimming beside the Chifbay boat in clear water", brava: "The Chifbay boat at anchor in turquoise water", sol: "Drone view of the coast at Ponta do Sol" },
    boat: { k: "The boat", h: "Yours, from bow to swim platform", lead: "One 9 metre Karnic, never shared. Here it is from the drone, with the places you will use most.",
      notes: [["Mercury V8, 300 hp", "Quick between coves, smooth on the run home."], ["Swim platform", "Straight into the water at Fajã dos Padres, with paddle boards on board."], ["Table under the shade", "Where drinks and food are served. Local wine, poncha, beer, soft drinks, snacks."], ["The helm", "Your licensed local skipper, who reads the coast every morning."], ["Bow sun pads", "Two wide pads up front for the sunny stretches."]],
      specs: ["2026 Karnic R8S", "9 m", "Up to 5 guests", "Bathroom on board"],
      alt: "Drone photo from above of the Chifbay boat, a 2026 Karnic R8S, at anchor in turquoise water with a paddle board behind it", pt: "Point" },
    sbar: { k: "From", btn: "Check dates" },
  },
  fr: {
    k: { from: "À partir de", dur: "Durée", dep: "Départ", light: "La lumière", swim: "Baignade", far: "Le plus loin", film: "En images" },
    perBoat: "par bateau, jusqu'à 5 personnes",
    day: { n: "01 · Jour", h: "La sortie de jour", light: "Soleil de midi, une eau où l'on voit le fond", swim: "Oui, à Fajã dos Padres. Paddles à bord", far: "Ribeira Brava, ou Ponta do Sol en 3h", film: "Images de drone. Le 3h ajoute une vidéo filmée", alt: "Vue de drone du bateau Chifbay au mouillage dans une eau turquoise à Madère" },
    sun: { n: "02 · Coucher de soleil", h: "La sortie coucher de soleil", light: "L'heure dorée, puis Funchal illuminée au retour", swim: "Non. Une balade, boissons et en-cas sur le pont", far: "Cabo Girão, ou Ribeira Brava en 2h30", film: "Images de drone à Cabo Girão", alt: "Une invitée à la proue du bateau Chifbay au coucher du soleil à Madère" },
    dates: "Choisir une date", see: "Voir la sortie",
    note: "Le même bateau, le même équipage, jamais partagé avec un autre groupe. Chaque prix est pour le bateau entier. <a href=\"/terms\">Conditions d'annulation</a>.",
    cmpLabel: "Comparer la sortie de jour et la sortie coucher de soleil",
    route: { k: "Le parcours", h: "Une seule côte, à l'ouest de Funchal", lead: "Chaque sortie suit la même côte, depuis la Marina do Funchal vers l'ouest, sous les falaises. Les distances sont réelles, par la mer.", legend: ["<b>Sortie de jour</b> jusqu'à Ribeira Brava, ou Ponta do Sol en 3h", "<b>Coucher de soleil</b> jusqu'à Cabo Girão, ou Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Retrouvez votre skipper sur le ponton, 15 minutes avant."],
      camara: ["Câmara de Lobos", "Le port de pêche que Churchill a peint, vu depuis l'eau."],
      girao: ["Cabo Girão", "580 m de falaise qui sortent de la mer. Le drone décolle ici."],
      faja: ["Fajã dos Padres", "La crique sans route. Baignade, plongeon, paddle. Sortie de jour."],
      brava: ["Ribeira Brava", "Là où la sortie de jour en 2h30 et le long coucher de soleil font demi-tour."],
      sol: ["Ponta do Sol", "Le point le plus à l'ouest de la sortie de 3h, filmée pour vous."],
    },
    stopAlt: { funchal: "Le ponton de la Marina do Funchal, départ des sorties Chifbay", camara: "Le bateau Chifbay le long de la côte sud de Madère", girao: "Des invités sur le bateau Chifbay sous les falaises", faja: "Une invitée nage à côté du bateau Chifbay dans une eau claire", brava: "Le bateau Chifbay au mouillage dans une eau turquoise", sol: "Vue de drone de la côte à Ponta do Sol" },
    boat: { k: "Le bateau", h: "À vous, de la proue à la plateforme de bain", lead: "Un seul Karnic de 9 mètres, jamais partagé. Le voici vu du drone, avec les endroits où vous passerez le plus de temps.",
      notes: [["Mercury V8, 300 ch", "Rapide entre les criques, confortable au retour."], ["Plateforme de bain", "Directement dans l'eau à Fajã dos Padres, avec des paddles à bord."], ["Table à l'ombre", "Là où l'on sert boissons et en-cas. Vin local, poncha, bière, softs."], ["Le poste de pilotage", "Votre skipper local et diplômé, qui lit la côte chaque matin."], ["Bains de soleil à l'avant", "Deux grands matelas pour les moments au soleil."]],
      specs: ["Karnic R8S 2026", "9 m", "Jusqu'à 5 personnes", "Toilettes à bord"],
      alt: "Photo de drone vue du dessus du bateau Chifbay, un Karnic R8S 2026, au mouillage dans une eau turquoise avec un paddle derrière", pt: "Point" },
    sbar: { k: "À partir de", btn: "Voir les dates" },
  },
  de: {
    k: { from: "Ab", dur: "Dauer", dep: "Abfahrt", light: "Das Licht", swim: "Baden", far: "Am weitesten", film: "Im Film" },
    perBoat: "pro Boot, bis zu 5 Gäste",
    day: { n: "01 · Tag", h: "Die Tagestour", light: "Mittagssonne, Wasser bis auf den Grund klar", swim: "Ja, in Fajã dos Padres. Paddleboards an Bord", far: "Ribeira Brava, oder Ponta do Sol bei 3 Std.", film: "Drohnenaufnahmen. Die 3 Std. mit gefilmtem Video", alt: "Drohnenblick auf das Chifbay Boot vor Anker in türkisem Wasser vor Madeira" },
    sun: { n: "02 · Sonnenuntergang", h: "Die Sonnenuntergangstour", light: "Goldene Stunde, dann das beleuchtete Funchal auf dem Rückweg", swim: "Nein. Eine Genussfahrt, Getränke und Snacks an Deck", far: "Cabo Girão, oder Ribeira Brava bei 2,5 Std.", film: "Drohnenaufnahmen am Cabo Girão", alt: "Ein Gast am Bug des Chifbay Boots bei Sonnenuntergang vor Madeira" },
    dates: "Datum wählen", see: "Zur Tour",
    note: "Dasselbe Boot, dieselbe Crew, nie mit einer anderen Gruppe geteilt. Jeder Preis gilt für das ganze Boot. <a href=\"/terms\">Stornobedingungen</a>.",
    cmpLabel: "Tagestour und Sonnenuntergangstour vergleichen",
    route: { k: "Die Route", h: "Eine Küste, westlich von Funchal", lead: "Jede Tour fährt dieselbe Küste, aus der Marina do Funchal nach Westen unter den Klippen entlang. Die Entfernungen sind echt, über das Meer.", legend: ["<b>Tagestour</b> bis Ribeira Brava, oder Ponta do Sol bei 3 Std.", "<b>Sonnenuntergang</b> bis Cabo Girão, oder Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Treffpunkt mit dem Skipper am Steg, 15 Minuten vorher."],
      camara: ["Câmara de Lobos", "Der Fischerhafen, den Churchill malte, vom Wasser aus."],
      girao: ["Cabo Girão", "580 m Klippe direkt aus dem Meer. Hier fliegt die Drohne."],
      faja: ["Fajã dos Padres", "Die Bucht ohne Straße. Baden, springen, paddeln. Tagestour."],
      brava: ["Ribeira Brava", "Hier wenden die 2,5 Std. Tagestour und der längere Sonnenuntergang."],
      sol: ["Ponta do Sol", "Der westlichste Punkt der 3 Std. Tour, für Sie gefilmt."],
    },
    stopAlt: { funchal: "Der Steg in der Marina do Funchal, wo die Chifbay Touren starten", camara: "Das Chifbay Boot an der Südküste Madeiras", girao: "Gäste auf dem Chifbay Boot unter den Klippen", faja: "Ein Gast schwimmt neben dem Chifbay Boot in klarem Wasser", brava: "Das Chifbay Boot vor Anker in türkisem Wasser", sol: "Drohnenblick auf die Küste bei Ponta do Sol" },
    boat: { k: "Das Boot", h: "Ihres, vom Bug bis zur Badeplattform", lead: "Eine 9 Meter Karnic, nie geteilt. Hier von der Drohne aus, mit den Plätzen, die Sie am meisten nutzen.",
      notes: [["Mercury V8, 300 PS", "Schnell zwischen den Buchten, ruhig auf der Rückfahrt."], ["Badeplattform", "Direkt ins Wasser in Fajã dos Padres, Paddleboards an Bord."], ["Tisch im Schatten", "Hier gibt es Getränke und Snacks. Lokaler Wein, Poncha, Bier, Softdrinks."], ["Der Steuerstand", "Ihr lizenzierter Skipper von hier, der jeden Morgen die Küste liest."], ["Sonnenpolster am Bug", "Zwei breite Polster vorne für die sonnigen Strecken."]],
      specs: ["Karnic R8S 2026", "9 m", "Bis zu 5 Gäste", "Toilette an Bord"],
      alt: "Drohnenfoto von oben auf das Chifbay Boot, eine Karnic R8S 2026, vor Anker in türkisem Wasser mit einem Paddleboard dahinter", pt: "Punkt" },
    sbar: { k: "Ab", btn: "Termine ansehen" },
  },
  pt: {
    k: { from: "Desde", dur: "Duração", dep: "Partida", light: "A luz", swim: "Banho", far: "Ponto mais longe", film: "Em vídeo" },
    perBoat: "por barco, até 5 pessoas",
    day: { n: "01 · Dia", h: "O passeio de dia", light: "Sol do meio dia, água onde se vê o fundo", swim: "Sim, na Fajã dos Padres. Pranchas de paddle a bordo", far: "Ribeira Brava, ou Ponta do Sol no de 3h", film: "Imagens de drone. O de 3h inclui um vídeo filmado", alt: "Vista de drone do barco Chifbay ancorado em água turquesa na Madeira" },
    sun: { n: "02 · Pôr do sol", h: "O passeio ao pôr do sol", light: "A hora dourada, depois o Funchal iluminado no regresso", swim: "Não. Um passeio, bebidas e petiscos no convés", far: "Cabo Girão, ou Ribeira Brava no de 2h30", film: "Imagens de drone no Cabo Girão", alt: "Uma convidada na proa do barco Chifbay ao pôr do sol na Madeira" },
    dates: "Escolher data", see: "Ver o passeio",
    note: "O mesmo barco, a mesma tripulação, nunca partilhado com outro grupo. Cada preço é para o barco inteiro. <a href=\"/terms\">Condições de cancelamento</a>.",
    cmpLabel: "Comparar o passeio de dia e o passeio ao pôr do sol",
    route: { k: "O percurso", h: "Uma costa, a oeste do Funchal", lead: "Todos os passeios seguem a mesma costa, da Marina do Funchal para oeste, por baixo das falésias. As distâncias são reais, por mar.", legend: ["<b>Passeio de dia</b> até à Ribeira Brava, ou Ponta do Sol no de 3h", "<b>Pôr do sol</b> até ao Cabo Girão, ou Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Encontro com o skipper no pontão, 15 minutos antes."],
      camara: ["Câmara de Lobos", "O porto de pesca que Churchill pintou, visto do mar."],
      girao: ["Cabo Girão", "580 m de falésia a sair do mar. O drone levanta voo aqui."],
      faja: ["Fajã dos Padres", "A enseada sem estrada. Banho, saltos, paddle. Passeio de dia."],
      brava: ["Ribeira Brava", "Onde o passeio de dia de 2h30 e o pôr do sol mais longo dão a volta."],
      sol: ["Ponta do Sol", "O ponto mais a oeste do passeio de 3h, filmado para si."],
    },
    stopAlt: { funchal: "O pontão da Marina do Funchal, onde começam os passeios Chifbay", camara: "O barco Chifbay na costa sul da Madeira", girao: "Convidados no barco Chifbay por baixo das falésias", faja: "Uma convidada a nadar junto ao barco Chifbay em água limpa", brava: "O barco Chifbay ancorado em água turquesa", sol: "Vista de drone da costa na Ponta do Sol" },
    boat: { k: "O barco", h: "Seu, da proa à plataforma de banho", lead: "Um Karnic de 9 metros, nunca partilhado. Aqui visto do drone, com os sítios que mais vai usar.",
      notes: [["Mercury V8, 300 cv", "Rápido entre enseadas, suave no regresso."], ["Plataforma de banho", "Direto para a água na Fajã dos Padres, com pranchas de paddle a bordo."], ["Mesa à sombra", "Onde se servem bebidas e petiscos. Vinho local, poncha, cerveja, refrigerantes."], ["O leme", "O seu skipper local e certificado, que lê a costa todas as manhãs."], ["Solários na proa", "Dois colchões largos à frente para os troços ao sol."]],
      specs: ["Karnic R8S 2026", "9 m", "Até 5 pessoas", "Casa de banho a bordo"],
      alt: "Foto de drone vista de cima do barco Chifbay, um Karnic R8S 2026, ancorado em água turquesa com uma prancha de paddle atrás", pt: "Ponto" },
    sbar: { k: "Desde", btn: "Ver datas" },
  },
  es: {
    k: { from: "Desde", dur: "Duración", dep: "Salida", light: "La luz", swim: "Baño", far: "Punto más lejano", film: "En vídeo" },
    perBoat: "por barco, hasta 5 personas",
    day: { n: "01 · Día", h: "La salida de día", light: "Sol de mediodía, agua en la que se ve el fondo", swim: "Sí, en Fajã dos Padres. Tablas de paddle a bordo", far: "Ribeira Brava, o Ponta do Sol en la de 3h", film: "Imágenes de dron. La de 3h añade un vídeo grabado", alt: "Vista de dron del barco Chifbay fondeado en agua turquesa en Madeira" },
    sun: { n: "02 · Atardecer", h: "La salida al atardecer", light: "La hora dorada, luego Funchal iluminado a la vuelta", swim: "No. Un paseo, bebidas y picoteo en cubierta", far: "Cabo Girão, o Ribeira Brava en la de 2h30", film: "Imágenes de dron en Cabo Girão", alt: "Una invitada en la proa del barco Chifbay al atardecer en Madeira" },
    dates: "Elegir fecha", see: "Ver la salida",
    note: "El mismo barco, la misma tripulación, nunca compartido con otro grupo. Cada precio es por el barco entero. <a href=\"/terms\">Condiciones de cancelación</a>.",
    cmpLabel: "Comparar la salida de día y la salida al atardecer",
    route: { k: "La ruta", h: "Una costa, al oeste de Funchal", lead: "Todas las salidas recorren la misma costa, desde la Marina do Funchal hacia el oeste, bajo los acantilados. Las distancias son reales, por mar.", legend: ["<b>Salida de día</b> hasta Ribeira Brava, o Ponta do Sol en la de 3h", "<b>Atardecer</b> hasta Cabo Girão, o Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Encuentro con el patrón en el pantalán, 15 minutos antes."],
      camara: ["Câmara de Lobos", "El puerto pesquero que pintó Churchill, visto desde el agua."],
      girao: ["Cabo Girão", "580 m de acantilado saliendo del mar. Aquí despega el dron."],
      faja: ["Fajã dos Padres", "La cala sin carretera. Baño, saltos, paddle. Salida de día."],
      brava: ["Ribeira Brava", "Donde la salida de día de 2h30 y el atardecer largo dan la vuelta."],
      sol: ["Ponta do Sol", "El punto más al oeste de la salida de 3h, grabada para ti."],
    },
    stopAlt: { funchal: "El pantalán de la Marina do Funchal, donde empiezan las salidas Chifbay", camara: "El barco Chifbay por la costa sur de Madeira", girao: "Invitados en el barco Chifbay bajo los acantilados", faja: "Una invitada nada junto al barco Chifbay en agua clara", brava: "El barco Chifbay fondeado en agua turquesa", sol: "Vista de dron de la costa en Ponta do Sol" },
    boat: { k: "El barco", h: "Tuyo, de la proa a la plataforma de baño", lead: "Un Karnic de 9 metros, nunca compartido. Aquí visto desde el dron, con los sitios que más vas a usar.",
      notes: [["Mercury V8, 300 CV", "Rápido entre calas, suave a la vuelta."], ["Plataforma de baño", "Directo al agua en Fajã dos Padres, con tablas de paddle a bordo."], ["Mesa a la sombra", "Donde se sirven bebidas y picoteo. Vino local, poncha, cerveza, refrescos."], ["El timón", "Tu patrón local con licencia, que lee la costa cada mañana."], ["Solárium en proa", "Dos colchonetas anchas delante para los tramos al sol."]],
      specs: ["Karnic R8S 2026", "9 m", "Hasta 5 personas", "Baño a bordo"],
      alt: "Foto de dron desde arriba del barco Chifbay, un Karnic R8S 2026, fondeado en agua turquesa con una tabla de paddle detrás", pt: "Punto" },
    sbar: { k: "Desde", btn: "Ver fechas" },
  },
  it: {
    k: { from: "Da", dur: "Durata", dep: "Partenza", light: "La luce", swim: "Bagno", far: "Punto più lontano", film: "In video" },
    perBoat: "a barca, fino a 5 persone",
    day: { n: "01 · Giorno", h: "L'uscita di giorno", light: "Sole di mezzogiorno, acqua in cui si vede il fondo", swim: "Sì, a Fajã dos Padres. Tavole da paddle a bordo", far: "Ribeira Brava, o Ponta do Sol con le 3h", film: "Riprese col drone. Le 3h aggiungono un video girato", alt: "Vista dal drone della barca Chifbay all'ancora in acqua turchese a Madeira" },
    sun: { n: "02 · Tramonto", h: "L'uscita al tramonto", light: "L'ora d'oro, poi Funchal illuminata al ritorno", swim: "No. Un giro in barca, drink e stuzzichini in coperta", far: "Cabo Girão, o Ribeira Brava con le 2h30", film: "Riprese col drone a Cabo Girão", alt: "Un'ospite a prua della barca Chifbay al tramonto a Madeira" },
    dates: "Scegli una data", see: "Vedi l'uscita",
    note: "La stessa barca, lo stesso equipaggio, mai condivisa con un altro gruppo. Ogni prezzo è per la barca intera. <a href=\"/terms\">Condizioni di cancellazione</a>.",
    cmpLabel: "Confronta l'uscita di giorno e l'uscita al tramonto",
    route: { k: "Il percorso", h: "Una costa, a ovest di Funchal", lead: "Ogni uscita segue la stessa costa, dalla Marina do Funchal verso ovest, sotto le scogliere. Le distanze sono reali, via mare.", legend: ["<b>Uscita di giorno</b> fino a Ribeira Brava, o Ponta do Sol con le 3h", "<b>Tramonto</b> fino a Cabo Girão, o Ribeira Brava"] },
    stops: {
      funchal: ["Marina do Funchal", "Incontro con lo skipper sul pontile, 15 minuti prima."],
      camara: ["Câmara de Lobos", "Il porto di pescatori che Churchill dipinse, visto dal mare."],
      girao: ["Cabo Girão", "580 m di scogliera che escono dal mare. Qui si alza il drone."],
      faja: ["Fajã dos Padres", "La caletta senza strada. Bagno, tuffi, paddle. Uscita di giorno."],
      brava: ["Ribeira Brava", "Dove l'uscita di giorno di 2h30 e il tramonto lungo tornano indietro."],
      sol: ["Ponta do Sol", "Il punto più a ovest dell'uscita di 3h, filmata per te."],
    },
    stopAlt: { funchal: "Il pontile della Marina do Funchal, dove partono le uscite Chifbay", camara: "La barca Chifbay lungo la costa sud di Madeira", girao: "Ospiti sulla barca Chifbay sotto le scogliere", faja: "Un'ospite nuota accanto alla barca Chifbay in acqua limpida", brava: "La barca Chifbay all'ancora in acqua turchese", sol: "Vista dal drone della costa a Ponta do Sol" },
    boat: { k: "La barca", h: "Tua, dalla prua alla piattaforma bagno", lead: "Un Karnic di 9 metri, mai condiviso. Eccolo visto dal drone, con i posti che userete di più.",
      notes: [["Mercury V8, 300 CV", "Veloce tra le calette, morbido al ritorno."], ["Piattaforma bagno", "Dritti in acqua a Fajã dos Padres, con tavole da paddle a bordo."], ["Tavolo all'ombra", "Dove si servono drink e stuzzichini. Vino locale, poncha, birra, bibite."], ["Il timone", "Il tuo skipper locale con licenza, che legge la costa ogni mattina."], ["Prendisole a prua", "Due materassini larghi davanti per i tratti al sole."]],
      specs: ["Karnic R8S 2026", "9 m", "Fino a 5 persone", "Bagno a bordo"],
      alt: "Foto dal drone dall'alto della barca Chifbay, un Karnic R8S 2026, all'ancora in acqua turchese con una tavola da paddle dietro", pt: "Punto" },
    sbar: { k: "Da", btn: "Vedi le date" },
  },
};

const STOPS = [
  { id: "funchal", km: 0, img: "assets/marina.jpg", w: 1600, h: 1200 },
  { id: "camara", km: 6, img: "assets/gallery/g11.jpg", w: 1080, h: 810 },
  { id: "girao", km: 9, img: "assets/gallery/g20.jpg", w: 1080, h: 810 },
  { id: "faja", km: 11.5, img: "assets/gallery/g09.jpg", w: 1080, h: 810 },
  { id: "brava", km: 14, img: "assets/gallery/g13.jpg", w: 1080, h: 810 },
  { id: "sol", km: 17.5, img: "assets/ponta-do-sol.jpg", w: 1600, h: 1067 },
];
// x%, y% on the full drone photo (941 x 1672, stern at the top)
const HOTSPOTS = [[49.6, 27.6], [61.2, 31.2], [50.2, 41.6], [44.6, 47.4], [50.2, 64.5]];
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const block = (name, html) => `<!-- tide:${name} -->\n${html}\n<!-- /tide:${name} -->`;
const markerRe = (name) => new RegExp(`<!-- tide:${name} -->[\\s\\S]*?<!-- /tide:${name} -->`, "g");
// put a block back where it was, or insert it the first time with `first`
function upsert(h, name, html, first) {
  const re = markerRe(name);
  return re.test(h) ? h.replace(markerRe(name), () => html) : first(h);
}

function compare(t, P, gridOnly) {
  const card = (key, trip, img, book, page, mood) => {
    const c = t[key];
    return `    <article class="t-card" data-mood="${mood}">
      <a class="t-card-media" href="${P}${page}" tabindex="-1" aria-hidden="true"><img src="${P}${img}" alt="${c.alt}" loading="lazy" decoding="async" width="1600" height="1000">
        <div class="t-card-title"><span class="t-n">${c.n}</span><h3>${c.h}</h3></div></a>
      <ul class="t-rows">
        <li><span class="k">${t.k.from}</span><span class="v"><b data-cb-price="${trip}">${trip === "sunset" ? "€400" : "€500"}</b> <small>${t.perBoat}</small></span></li>
        <li><span class="k">${t.k.dur}</span><span class="v" data-cb-dur="${trip}">${trip === "sunset" ? "2h / 2h30" : "2h30 / 3h"}</span></li>
        <li><span class="k">${t.k.dep}</span><span class="v" data-cb-times="${trip}">${trip === "sunset" ? "18:30" : "10:00 · 14:00"}</span></li>
        <li><span class="k">${t.k.light}</span><span class="v">${c.light}</span></li>
        <li><span class="k">${t.k.swim}</span><span class="v">${c.swim}</span></li>
        <li><span class="k">${t.k.far}</span><span class="v">${c.far}</span></li>
        <li><span class="k">${t.k.film}</span><span class="v">${c.film}</span></li>
      </ul>
      <div class="t-card-cta"><a class="btn btn-p" href="${book}">${t.dates} ${ARROW}</a><a class="btn btn-g" href="${P}${page}">${t.see}</a></div>
    </article>`;
  };
  if (gridOnly) return block("compare", `<div class="t-cmp-grid" role="group" aria-label="${t.cmpLabel}">
${card("day", "day-trip", "assets/exp-coves-wide.jpg", "/book-day", "hidden-coves-half-day", "day")}
${card("sun", "sunset", "assets/exp-sunset.jpg", "/book-sunset", "sunset-cruise", "sunset")}
    </div>`);
  return block("compare", `<section class="t-cmp" style="padding-top:8px" aria-label="${t.cmpLabel}">
  <div class="t-wrap">
  <div class="t-cmp-grid">
${card("day", "day-trip", "assets/exp-coves-wide.jpg", "/book-day", "hidden-coves-half-day", "day")}
${card("sun", "sunset", "assets/exp-sunset.jpg", "/book-sunset", "sunset-cruise", "sunset")}
  </div>
  <p class="t-cmp-note">${t.note}</p>
  </div>
</section>`);
}

function route(t, P, ids, num) {
  const r = t.route;
  const list = STOPS.filter((s) => !ids || ids.includes(s.id));
  const items = list.map((s, i) => `      <li class="t-stop" data-id="${s.id}" data-km="${s.km}">
        <figure><img src="${P}${s.img}" alt="${t.stopAlt[s.id]}" loading="lazy" decoding="async" width="${s.w}" height="${s.h}"></figure>
        <div class="t-sb"><span class="t-sn">${String(i + 1).padStart(2, "0")} · ${s.km} km</span><h3>${t.stops[s.id][0]}</h3><p>${t.stops[s.id][1]}</p></div>
      </li>`).join("\n");
  return block("route", `<section class="t-route chapter">
  <div class="t-wrap">
    <div class="chead reveal">${num ? `<span class="cn">${num}</span>` : ""}<span class="cl">${r.k}</span></div>
    <h2 class="reveal">${r.h}</h2>
    <p class="t-lead reveal d1">${r.lead}</p>
    <div class="t-map" aria-hidden="true"></div>
    <ol class="t-stops">
${items}
    </ol>
    <div class="t-legend">${r.legend.map((x) => `<span>${x}</span>`).join("")}</div>
  </div>
</section>`);
}

function boat(t, P) {
  const b = t.boat;
  const hs = HOTSPOTS.map(([x, y], i) => `<button type="button" class="t-hs" style="left:${x}%;top:${y}%" aria-label="${b.pt} ${i + 1}: ${b.notes[i][0]}">${i + 1}</button>`).join("");
  const notes = b.notes.map((n, i) => `        <li class="t-bnote"><span class="n">${String(i + 1).padStart(2, "0")}</span><div><h3>${n[0]}</h3><p>${n[1]}</p></div></li>`).join("\n");
  return block("boat", `<section class="t-boat">
  <div class="t-wrap">
    <figure class="t-bfig" style="aspect-ratio:941/1672;max-height:86vh;justify-self:center;width:auto">
      <img src="${P}assets/exp-coves.jpg" alt="${b.alt}" loading="lazy" decoding="async" width="941" height="1672" style="object-fit:contain">
      ${hs}
    </figure>
    <div>
      <div class="chead reveal"><span class="cl">${b.k}</span></div>
      <h2 class="reveal">${b.h}</h2>
      <p class="t-lead reveal d1">${b.lead}</p>
      <ol class="t-bnotes">
${notes}
      </ol>
      <div class="t-specs">${b.specs.map((s) => `<span>${s}</span>`).join("")}</div>
    </div>
  </div>
</section>`);
}

function sbar(t, trip, book) {
  return block("sbar", `<div class="t-sbar" role="region" aria-label="${t.dates}"><div><span class="t-sbar-k">${t.sbar.k}</span><span class="t-sbar-v" data-cb-price="${trip}">${trip === "sunset" ? "€400" : "€500"}</span></div><a class="btn" href="${book}">${t.sbar.btn} ${ARROW}</a></div>`);
}

/* ----------------------------------------------------------------- apply */
let changed = 0;
const problems = [];
function edit(rel, fn) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { problems.push(rel + ": missing"); return; }
  const before = fs.readFileSync(file, "utf8");
  const code = (before.match(/<html[^>]*\slang="([a-z]{2})/i) || [, "en"])[1];
  const t = T[code] || T.en;
  const P = rel.includes("/") ? "../" : "";
  let h = fn(before, t, P, rel);
  if (h !== before) { changed++; if (WRITE) fs.writeFileSync(file, h); }
}
function must(h, re, rel, what) { if (!re.test(h)) problems.push(`${rel}: no ${what}`); }

for (const L of LANGS) {
  const pre = L ? L + "/" : "";

  edit(pre + "index.html", (h, t, P, rel) => {
    h = h.replace(/<header class="hero hero-v">/, '<header class="hero hero-v t-frame">');
    // hero: the second button scrolls to the comparison on this page
    h = h.replace(/(<div class="hact">[\s\S]*?<a class="btn btn-g btn-lg" href=")experiences(")/, "$1#exp$2");
    // hero essentials: the lowest live price
    h = h.replace(/(<div class="tour-meta">[\s\S]*?<span class="now")(>)/, (m, a, b) => (a.includes("data-cb-price") ? m : `${a} data-cb-price="min"${b}`));
    // the three small feature cards go: their content lives in "The boat"
    h = h.replace(/<!-- FEATURES[^>]*-->\s*<section>[\s\S]*?<\/section>\s*/, "");
    // the comparison replaces the two alternating cards
    h = upsert(h, "compare", compare(t, P), (x) => {
      must(x, /<div class="xps">/, rel, "xps");
      return x.replace(/<div class="xps">[\s\S]*?<\/article>\s*<\/div>\s*\n/, () => compare(t, P) + "\n\n");
    });
    // route after the media block, boat before chapter 03
    h = upsert(h, "route", route(t, P), (x) => x.replace(/(<!-- \/media-included -->\n)/, (m) => `${m}${route(t, P)}\n`));
    h = upsert(h, "boat", boat(t, P), (x) => x.replace(/(<!-- CHAPTER 03)/, (m) => `${boat(t, P)}\n\n${m}`));
    // the old little route line in the Cabo Girao band
    h = h.replace(/\s*<div class="route-fig reveal d1">[\s\S]*?<\/svg>\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/div>/, "");
    // light on the water, over the closing photo
    if (!h.includes('class="t-caustic"')) h = h.replace(/(<section class="reserve"[^>]*>\s*<div class="im"[^>]*><\/div>\s*<div class="ov"><\/div>)/, '$1\n  <canvas class="t-caustic" aria-hidden="true"></canvas>');
    return h;
  });

  // experiences: the two cards become the same comparison as the home page
  edit(pre + "experiences.html", (h, t, P, rel) => upsert(h, "compare", compare(t, P, true), (x) => {
    const i = x.indexOf('<div class="exg">');
    if (i < 0) { problems.push(rel + ": no exg"); return x; }
    const end = x.slice(i).search(/\n\s{4}<(p|div) class="rv"/);
    if (end < 0) { problems.push(rel + ": no end of exg"); return x; }
    return x.slice(0, i) + compare(t, P, true) + x.slice(i + end);
  }));

  for (const [page, trip, book, ids] of [
    ["hidden-coves-half-day.html", "day-trip", "/book-day", ["funchal", "camara", "girao", "faja", "brava", "sol"]],
    ["sunset-cruise.html", "sunset", "/book-sunset", ["funchal", "camara", "girao", "faja", "brava"]],
  ]) {
    edit(pre + page, (h, t, P, rel) => {
      h = h.replace(/<header class="hero sub">/, '<header class="hero sub t-frame">');
      h = h.replace(/(<div class="tour-meta">[\s\S]*?<span class="now")(>)/, (m, a, b) => (a.includes("data-cb-price") ? m : `${a} data-cb-price="${trip}"${b}`));
      // the route for this trip, just before the itinerary (the section
      // holding the timeline items, class tli)
      h = upsert(h, "route", route(t, P, ids), (x) => {
        const tli = x.indexOf('class="tli"');
        const at = tli >= 0 ? x.lastIndexOf("<section", tli) : -1;
        if (at < 0) { problems.push(rel + ": no itinerary, route not placed"); return x; }
        return x.slice(0, at) + route(t, P, ids) + "\n\n" + x.slice(at);
      });
      // mobile booking bar
      h = upsert(h, "sbar", sbar(t, trip, book), (x) => x.replace(/(<script src="\/tide\.min\.js" defer><\/script>)/, (m) => `${sbar(t, trip, book)}\n${m}`));
      if (!h.includes('class="t-caustic"')) h = h.replace(/(<section class="reserve"[^>]*>\s*<div class="im"[^>]*><\/div>\s*<div class="ov"><\/div>)/, '$1\n  <canvas class="t-caustic" aria-hidden="true"></canvas>');
      return h;
    });
  }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} page(s) changed`);
if (problems.length) console.log("check:\n  " + problems.join("\n  "));
