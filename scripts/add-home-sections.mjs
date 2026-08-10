/**
 * Add the 2026-08-10 homepage sections to the localized homepages.
 *
 *   node scripts/add-home-sections.mjs [lang ...]     (default: fr de pt es it)
 *
 * The English homepage is the source of truth; this copies its two new
 * sections — "Where to find us" (Google map, loaded on demand) and
 * "Follow the boat" (Instagram grid) — into /<lang>/index.html with
 * hand-written copy, fixes the relative asset paths, adds the map-home.js
 * tag, and fills the data-* attributes that reviews-home.js and map-home.js
 * read so the live review cards and the map speak the page's language.
 *
 * Written by hand rather than through i18n-build.mjs because that one needs
 * ANTHROPIC_API_KEY, and only fr.json exists as a local dictionary.
 *
 * Safe to re-run: a locale that already has the sections is skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["fr", "de", "pt", "es", "it"];

const T = {
  fr: {
    mapNum: "Où nous trouver",
    mapH2: "Marina do Funchal, côté ponton",
    mapP: "Chaque sortie Chifbay part de la Marina do Funchal, au milieu du front de mer et à quelques minutes à pied de la vieille ville. Votre skipper vous retrouve sur le ponton — pas de bureau, pas de file, pas de navette.",
    lAddr: "L'adresse", lTime: "Soyez là", lCoord: "Coordonnées",
    vAddr: "Marina do Funchal, 9000-055 Funchal, Madère, Portugal",
    vTime: "15 minutes avant le départ — 10h00 et 14h00 pour les sorties journée, 18h00 pour le coucher de soleil",
    openMaps: "Ouvrir dans Google Maps",
    stubNote: "La carte est servie par Google et dépose ses propres cookies : nous ne la chargeons que si vous le demandez.",
    showMap: "Afficher la carte",
    mapTitle: "Carte de la Marina do Funchal, point de départ des sorties Chifbay",
    igNum: "Suivez le bateau",
    igH2: "Madère, presque tous les jours",
    igCta: "Suivre sur Instagram",
    verified: "Avis vérifié", reviewsWord: "avis",
    average: "★ de moyenne sur {n} avis vérifiés",
    railLabel: "Avis des invités, faites défiler",
    prev: "Avis précédents", next: "Avis suivants",
    alts: [
      "Le bateau privé Chifbay au mouillage sur une eau turquoise à Madère, des invités à la nage",
      "Une invitée en snorkeling dans une crique claire sous les falaises de Madère, moitié au-dessus, moitié sous l'eau",
      "Un dauphin sauvage bondissant hors de l'Atlantique près du bateau, au large de Funchal",
      "Un couple debout à la proue du bateau devant un coucher de soleil rouge profond à Madère",
      "Des invités trinquent avec des boissons fraîches sur le pont pendant une sortie privée Chifbay",
      "Les maisons colorées de Câmara de Lobos vues depuis la mer à l'heure dorée",
      "Nourriture et boissons dressées sur la table du pont pendant que le skipper s'occupe de ses invités",
      "La Marina do Funchal illuminée au crépuscule, vue d'en haut — le point de départ de chaque sortie Chifbay",
    ],
  },
  de: {
    mapNum: "So finden Sie uns",
    mapH2: "Marina do Funchal, direkt am Steg",
    mapP: "Jede Chifbay-Tour startet in der Marina do Funchal, mitten an der Uferpromenade und nur wenige Gehminuten von der Altstadt entfernt. Ihr Skipper empfängt Sie am Steg — kein Büro, keine Schlange, kein Shuttle.",
    lAddr: "Die Adresse", lTime: "Bitte da sein", lCoord: "Koordinaten",
    vAddr: "Marina do Funchal, 9000-055 Funchal, Madeira, Portugal",
    vTime: "15 Minuten vor der Abfahrt — 10:00 und 14:00 Uhr für die Tagestouren, 18:00 Uhr für den Sonnenuntergang",
    openMaps: "In Google Maps öffnen",
    stubNote: "Die Karte kommt von Google und setzt eigene Cookies. Deshalb laden wir sie erst, wenn Sie es möchten.",
    showMap: "Karte anzeigen",
    mapTitle: "Karte der Marina do Funchal, Startpunkt aller Chifbay-Bootstouren",
    igNum: "Folgen Sie dem Boot",
    igH2: "Madeira, fast jeden Tag",
    igCta: "Auf Instagram folgen",
    verified: "Verifiziert", reviewsWord: "Bewertungen",
    average: "★ Durchschnitt aus {n} verifizierten Bewertungen",
    railLabel: "Gästebewertungen, scrollbar",
    prev: "Vorherige Bewertungen", next: "Weitere Bewertungen",
    alts: [
      "Das private Chifbay-Boot ankert über klarem türkisem Wasser vor Madeira, Gäste schwimmen daneben",
      "Ein Gast beim Schnorcheln in einer klaren Bucht unter den Klippen Madeiras, halb über und halb unter Wasser",
      "Ein wilder Delfin springt vor Funchal neben dem Boot aus dem Atlantik",
      "Ein Paar steht am Bug des Bootes vor einem tiefroten Sonnenuntergang auf Madeira",
      "Gäste stoßen an Deck mit gekühlten Getränken an, während einer privaten Chifbay-Tour",
      "Die bunten Häuser von Câmara de Lobos, vom Wasser aus zur goldenen Stunde gesehen",
      "Essen und Getränke auf dem Decktisch, während der Skipper sich um seine Gäste kümmert",
      "Die Marina do Funchal bei Dämmerung von oben — der Startpunkt jeder Chifbay-Tour",
    ],
  },
  pt: {
    mapNum: "Onde nos encontrar",
    mapH2: "Marina do Funchal, junto ao pontão",
    mapP: "Todos os passeios da Chifbay partem da Marina do Funchal, no meio da marginal e a poucos minutos a pé da zona velha. O skipper recebe-o no pontão — sem escritório, sem filas, sem transfers.",
    lAddr: "A morada", lTime: "Esteja lá", lCoord: "Coordenadas",
    vAddr: "Marina do Funchal, 9000-055 Funchal, Madeira, Portugal",
    vTime: "15 minutos antes da partida — 10:00 e 14:00 nos passeios de dia, 18:00 no pôr do sol",
    openMaps: "Abrir no Google Maps",
    stubNote: "O mapa é servido pela Google e cria os seus próprios cookies, por isso só o carregamos quando pedir.",
    showMap: "Mostrar o mapa",
    mapTitle: "Mapa da Marina do Funchal, ponto de partida dos passeios da Chifbay",
    igNum: "Siga o barco",
    igH2: "Madeira, quase todos os dias",
    igCta: "Seguir no Instagram",
    verified: "Avaliação verificada", reviewsWord: "avaliações",
    average: "★ de média em {n} avaliações verificadas",
    railLabel: "Avaliações de clientes, deslize para ver mais",
    prev: "Avaliações anteriores", next: "Avaliações seguintes",
    alts: [
      "O barco privado da Chifbay fundeado sobre água turquesa na Madeira, com clientes a nadar ao lado",
      "Uma cliente a fazer snorkeling numa enseada clara sob as falésias da Madeira, meio acima e meio abaixo de água",
      "Um golfinho selvagem a saltar do Atlântico ao lado do barco, ao largo do Funchal",
      "Um casal na proa do barco perante um pôr do sol vermelho intenso na Madeira",
      "Clientes a brindar com bebidas frescas no convés durante um passeio privado da Chifbay",
      "As casas coloridas de Câmara de Lobos vistas do mar à hora dourada",
      "Comida e bebidas na mesa do convés enquanto o skipper cuida dos seus clientes",
      "A Marina do Funchal iluminada ao anoitecer, vista de cima — o ponto de partida de cada passeio",
    ],
  },
  es: {
    mapNum: "Dónde encontrarnos",
    mapH2: "Marina do Funchal, junto al pantalán",
    mapP: "Todas las salidas de Chifbay parten de la Marina do Funchal, en pleno paseo marítimo y a pocos minutos a pie del casco antiguo. Tu patrón te recibe en el pantalán: sin oficina, sin colas, sin traslados.",
    lAddr: "La dirección", lTime: "Llega para las", lCoord: "Coordenadas",
    vAddr: "Marina do Funchal, 9000-055 Funchal, Madeira, Portugal",
    vTime: "15 minutos antes de la salida — 10:00 y 14:00 en las salidas de día, 18:00 en la del atardecer",
    openMaps: "Abrir en Google Maps",
    stubNote: "El mapa lo sirve Google y crea sus propias cookies, así que solo lo cargamos cuando tú lo pides.",
    showMap: "Ver el mapa",
    mapTitle: "Mapa de la Marina do Funchal, punto de salida de las salidas de Chifbay",
    igNum: "Sigue el barco",
    igH2: "Madeira, casi todos los días",
    igCta: "Seguir en Instagram",
    verified: "Opinión verificada", reviewsWord: "opiniones",
    average: "★ de media sobre {n} opiniones verificadas",
    railLabel: "Opiniones de clientes, desliza para ver más",
    prev: "Opiniones anteriores", next: "Opiniones siguientes",
    alts: [
      "El barco privado de Chifbay fondeado sobre agua turquesa en Madeira, con invitados bañándose al lado",
      "Una invitada haciendo snorkel en una cala transparente bajo los acantilados de Madeira, medio dentro y medio fuera del agua",
      "Un delfín salvaje saltando del Atlántico junto al barco, frente a Funchal",
      "Una pareja en la proa del barco ante un atardecer rojo intenso en Madeira",
      "Invitados brindando con bebidas frías en cubierta durante una salida privada de Chifbay",
      "Las casas de colores de Câmara de Lobos vistas desde el mar a la hora dorada",
      "Comida y bebida servidas en la mesa de cubierta mientras el patrón atiende a sus invitados",
      "La Marina do Funchal iluminada al anochecer, vista desde arriba: el punto de salida de cada salida",
    ],
  },
  it: {
    mapNum: "Dove trovarci",
    mapH2: "Marina do Funchal, lato pontile",
    mapP: "Ogni uscita Chifbay parte dalla Marina do Funchal, nel cuore del lungomare e a pochi minuti a piedi dal centro storico. Lo skipper vi accoglie sul pontile: niente ufficio, niente fila, niente navetta.",
    lAddr: "L'indirizzo", lTime: "Presentarsi", lCoord: "Coordinate",
    vAddr: "Marina do Funchal, 9000-055 Funchal, Madeira, Portogallo",
    vTime: "15 minuti prima della partenza — 10:00 e 14:00 per le uscite diurne, 18:00 per il tramonto",
    openMaps: "Apri in Google Maps",
    stubNote: "La mappa è servita da Google e crea cookie propri, per questo la carichiamo solo quando lo chiedete.",
    showMap: "Mostra la mappa",
    mapTitle: "Mappa della Marina do Funchal, punto di partenza delle uscite Chifbay",
    igNum: "Segui la barca",
    igH2: "Madeira, quasi ogni giorno",
    igCta: "Segui su Instagram",
    verified: "Recensione verificata", reviewsWord: "recensioni",
    average: "★ di media su {n} recensioni verificate",
    railLabel: "Recensioni degli ospiti, scorri per vedere",
    prev: "Recensioni precedenti", next: "Recensioni successive",
    alts: [
      "La barca privata Chifbay all'ancora su acqua turchese a Madeira, con ospiti che nuotano accanto",
      "Un'ospite fa snorkeling in una cala limpida sotto le scogliere di Madeira, metà sopra e metà sott'acqua",
      "Un delfino selvatico che salta fuori dall'Atlantico accanto alla barca, al largo di Funchal",
      "Una coppia sulla prua della barca davanti a un tramonto rosso intenso a Madeira",
      "Ospiti che brindano con bevande fresche in coperta durante un'uscita privata Chifbay",
      "Le case colorate di Câmara de Lobos viste dal mare nell'ora dorata",
      "Cibo e bevande sul tavolo di coperta mentre lo skipper si prende cura dei suoi ospiti",
      "La Marina do Funchal illuminata al crepuscolo, vista dall'alto — il punto di partenza di ogni uscita",
    ],
  },
};

const IG = "https://www.instagram.com/chifbay";
const MAPS_LINK = "https://www.google.com/maps/search/?api=1&amp;query=Marina+do+Funchal%2C+Funchal%2C+Madeira";
const esc = (s) => s.replace(/&(?!amp;|#\d+;|[a-z]+;)/g, "&amp;").replace(/"/g, "&quot;");

function sections(t) {
  const tiles = t.alts.map((alt, i) =>
    `        <a href="${IG}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" width="560" height="560" src="../assets/ig/ig-0${i + 1}.jpg" alt="${esc(alt)}"></a>`
  ).join("\n");

  return `
<!-- WHERE WE ARE — Marina do Funchal, map loaded on demand (see map-home.js) -->
<section class="chapter" style="padding-top:0">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">06</span><span class="cl">${esc(t.mapNum)}</span></div>
    <div class="mapsec">
      <div class="reveal">
        <h2 class="display" data-mask>${esc(t.mapH2)}</h2>
        <p>${esc(t.mapP)}</p>
        <ul class="mfacts">
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
            <div><span>${esc(t.lAddr)}</span>${esc(t.vAddr)}</div>
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/></svg>
            <div><span>${esc(t.lTime)}</span>${esc(t.vTime)}</div>
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18-2.6-2.6-2.6-15.4 0-18z"/></svg>
            <div><span>${esc(t.lCoord)}</span>32.6442° N · 16.9165° W</div>
          </li>
        </ul>
        <a class="btn btn-g" href="${MAPS_LINK}" target="_blank" rel="noopener">${esc(t.openMaps)}
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>
      <div class="mapbox reveal d1" id="mapBox" data-map-title="${esc(t.mapTitle)}">
        <div class="mapstub" id="mapStub">
          <svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
          <div class="mtitle">Marina do Funchal</div>
          <div class="mnote">${esc(t.stubNote)}</div>
          <button type="button" class="btn btn-p" id="mapLoad">${esc(t.showMap)}</button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- INSTAGRAM — our own photographs, linking to @chifbay -->
<section class="chapter" style="padding-top:0">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">07</span><span class="cl">${esc(t.igNum)}</span></div>
    <div class="igsec">
      <div class="ighead reveal">
        <div class="igh-l">
          <h2 class="display" data-mask>${esc(t.igH2)}</h2>
          <a class="ighandle" href="${IG}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>
            @chifbay</a>
        </div>
        <a class="btn btn-p" href="${IG}" target="_blank" rel="noopener">${esc(t.igCta)}
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>
      <div class="iggrid reveal d1">
${tiles}
      </div>
    </div>
  </div>
</section>

`;
}

let changed = 0;
for (const lang of LANGS) {
  const file = path.join(ROOT, lang, "index.html");
  if (!fs.existsSync(file)) { console.log("  skip (missing)", lang); continue; }
  let h = fs.readFileSync(file, "utf8");
  const t = T[lang];
  if (!t) { console.log("  skip (no copy)", lang); continue; }

  if (h.includes('id="mapBox"')) { console.log("  already done", lang); continue; }

  const anchor = "<!-- FINAL RESERVATION -->";
  if (!h.includes(anchor)) { console.log("  !! no anchor in", lang); continue; }
  h = h.replace(anchor, sections(t).trimStart() + anchor);

  // map-home.js next to reviews-home.js
  h = h.replace('<script src="../reviews-home.js" defer></script>',
                '<script src="../reviews-home.js" defer></script>\n<script src="../map-home.js" defer></script>');

  // localized wording for the live review cards
  h = h.replace('<div class="revs" id="revsLive">',
    `<div class="revs" id="revsLive" data-verified="${esc(t.verified)}" data-reviews-word="${esc(t.reviewsWord)}"` +
    ` data-average="${esc(t.average)}" data-rail-label="${esc(t.railLabel)}"` +
    ` data-prev="${esc(t.prev)}" data-next="${esc(t.next)}">`);

  fs.writeFileSync(file, h);
  console.log("  wrote", `${lang}/index.html`);
  changed++;
}
console.log(changed ? `\n${changed} locale homepage(s) updated.` : "\nNothing to do.");
