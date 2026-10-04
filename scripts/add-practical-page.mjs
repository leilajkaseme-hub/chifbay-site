#!/usr/bin/env node
// add-practical-page.mjs: writes /practical (and /fr/practical ... /it/practical),
// the "Practical information" page of the main menu.
//
//   node scripts/add-practical-page.mjs           dry run
//   node scripts/add-practical-page.mjs --write   write the six pages + sitemap
//
// Built from each language's contact page, so the head, menu, footer, scripts
// and language switch stay identical to the rest of the site. Only the head
// tags that name the page and the main content are replaced.
//
// Every fact below is one the site or the booking API already states:
// departure times and lengths (booking-api/catalog.js), free cancellation
// 24 h (CANCEL_HOURS, confirmed by the owner 2 Oct 2026), drone + Insta360 +
// photos on every trip (same date), meeting point and drinks list (home and
// booking pages). Nothing here is new information.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webpify } from "./lib/webp.mjs";
import { departureRanges } from "./lib/sunset.mjs";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const MAPS = "https://www.google.com/maps/search/?api=1&amp;query=Marina+do+Funchal%2C+Funchal%2C+Madeira";
const LANGS = ["en", "fr", "de", "pt", "es", "it"];

const T = {
  en: {
    title: "Practical information · Chifbay private boat trips, Funchal",
    desc: "Meeting point, departure and return times, what is on board and what to bring for a Chifbay private boat trip from Marina do Funchal.",
    crumb: "Practical information", badge: "Before you go", h1: "Practical <em>information</em>",
    sub: "Where to meet, when you leave and come back, what is on board and what to bring.",
    meetK: "Meeting point", meetH: "Marina do Funchal, pontoon side",
    meetP: "Every trip leaves from Marina do Funchal, in the middle of the seafront. Your skipper meets you on the pontoon. Be there 15 minutes before departure.",
    maps: "Open in Google Maps",
    timesK: "Times", timesH: "Departures and returns", timesNote: "All times are Funchal time. The sunset trip leaves 1 h 15 before sunset, rounded down to the quarter hour, so the light is right all year: the booking page shows the exact time for the day you pick.",
    monthK: "Sunset trip", monthH: "Departure times, month by month", monthTo: "to", monthNote: "Earliest and latest departure in each month, Funchal time. The time follows the sunset and the clock change at the end of March and October.",
    rows: [["Day trip · 2h30", "10:00 → 12:30 or 14:00 → 16:30"], ["Day trip · 3h", "10:00 → 13:00 or 14:00 → 17:00"], ["Sunset trip · 2h", "1 h 15 before sunset, back 2 h later"], ["Sunset trip · 2h30", "1 h 15 before sunset, back 2 h 30 later"]],
    inK: "On board", inH: "Included in every trip",
    inc: ["The whole boat for your group, up to 5 guests", "Two local skippers", "Food on board, with local wine, poncha, beer and soft drinks", "Insta360 360° video, drone footage from above (weather allowing) and high quality photos taken with a real camera", "A bathroom on board", "Paddle boards and swimming on the day trip"],
    bringK: "What to bring", bringH: "Pack light",
    bring: ["Swimwear and a towel for the day trip", "Sun cream and sunglasses", "A light jacket for the sunset trip", "Your phone, to find the pontoon"],
    polK: "Weather and cancellation", polH: "If plans change",
    pol: ["Free cancellation up to 24 hours before departure.", "If the sea is not safe we cancel, and you choose another date or get a full refund.", "Payment is by card for the whole boat, never per person."],
    terms: "Read the full terms",
    askK: "Questions", askH: "Talk to the skipper", wa: "WhatsApp", mail: "Email",
    cta: "Check availability",
  },
  fr: {
    title: "Infos pratiques · Chifbay, bateau privé à Funchal",
    desc: "Point de rendez vous, horaires, ce qui est à bord et quoi apporter pour une sortie en bateau privé Chifbay depuis la Marina do Funchal.",
    crumb: "Infos pratiques", badge: "Avant de partir", h1: "Infos <em>pratiques</em>",
    sub: "Où se retrouver, à quelle heure on part et on rentre, ce qu'il y a à bord et quoi apporter.",
    meetK: "Point de rendez vous", meetH: "Marina do Funchal, côté ponton",
    meetP: "Toutes les sorties partent de la Marina do Funchal, au milieu du front de mer. Votre skipper vous attend sur le ponton. Présentez vous 15 minutes avant le départ.",
    maps: "Ouvrir dans Google Maps",
    timesK: "Horaires", timesH: "Départs et retours", timesNote: "Toutes les heures sont celles de Funchal. La sortie coucher de soleil part 1 h 15 avant le coucher du soleil, arrondi au quart d'heure inférieur, pour avoir la bonne lumière toute l'année : la page de réservation affiche l'heure exacte du jour choisi.",
    monthK: "Coucher de soleil", monthH: "Heures de départ, mois par mois", monthTo: "à", monthNote: "Le départ le plus tôt et le plus tard de chaque mois, heure de Funchal. L'heure suit le coucher du soleil et le changement d'heure de fin mars et de fin octobre.",
    rows: [["Sortie de jour · 2h30", "10:00 → 12:30 ou 14:00 → 16:30"], ["Sortie de jour · 3h", "10:00 → 13:00 ou 14:00 → 17:00"], ["Coucher de soleil · 2h", "1 h 15 avant le coucher du soleil, retour 2 h plus tard"], ["Coucher de soleil · 2h30", "1 h 15 avant le coucher du soleil, retour 2 h 30 plus tard"]],
    inK: "À bord", inH: "Compris dans chaque sortie",
    inc: ["Tout le bateau pour votre groupe, jusqu'à 5 personnes", "Deux skippers locaux", "Repas à bord, avec vin local, poncha, bière et sodas", "Une vidéo 360° Insta360, des images de drone vues du ciel (si la météo le permet) et des photos de qualité prises avec un vrai appareil photo", "Des toilettes à bord", "Paddles et baignade pendant la sortie de jour"],
    bringK: "Quoi apporter", bringH: "Voyagez léger",
    bring: ["Maillot de bain et serviette pour la sortie de jour", "Crème solaire et lunettes de soleil", "Une veste légère pour le coucher de soleil", "Votre téléphone, pour trouver le ponton"],
    polK: "Météo et annulation", polH: "Si les plans changent",
    pol: ["Annulation gratuite jusqu'à 24 heures avant le départ.", "Si la mer n'est pas sûre, nous annulons et vous choisissez une autre date ou êtes remboursé en totalité.", "Le paiement se fait par carte, pour tout le bateau, jamais par personne."],
    terms: "Lire les conditions complètes",
    askK: "Questions", askH: "Parlez au skipper", wa: "WhatsApp", mail: "E-mail",
    cta: "Voir les disponibilités",
  },
  de: {
    title: "Praktische Infos · Chifbay Privatboot ab Funchal",
    desc: "Treffpunkt, Abfahrt und Rückkehr, was an Bord ist und was Sie mitbringen für eine private Chifbay Bootstour ab der Marina do Funchal.",
    crumb: "Praktische Infos", badge: "Vor der Fahrt", h1: "Praktische <em>Infos</em>",
    sub: "Wo wir uns treffen, wann es losgeht und zurückkommt, was an Bord ist und was Sie mitbringen.",
    meetK: "Treffpunkt", meetH: "Marina do Funchal, am Steg",
    meetP: "Jede Fahrt startet in der Marina do Funchal, mitten an der Uferpromenade. Ihr Skipper erwartet Sie am Steg. Seien Sie 15 Minuten vor der Abfahrt da.",
    maps: "In Google Maps öffnen",
    timesK: "Zeiten", timesH: "Abfahrt und Rückkehr", timesNote: "Alle Zeiten sind Ortszeit Funchal. Die Sonnenuntergangstour legt 1 Std. 15 Min. vor Sonnenuntergang ab, auf die Viertelstunde abgerundet, damit das Licht das ganze Jahr stimmt: die Buchungsseite zeigt die genaue Zeit für Ihren Tag.",
    monthK: "Sonnenuntergang", monthH: "Abfahrtszeiten, Monat für Monat", monthTo: "bis", monthNote: "Früheste und späteste Abfahrt jedes Monats, Ortszeit Funchal. Die Zeit folgt dem Sonnenuntergang und der Zeitumstellung Ende März und Ende Oktober.",
    rows: [["Tagestour · 2,5 Std.", "10:00 → 12:30 oder 14:00 → 16:30"], ["Tagestour · 3 Std.", "10:00 → 13:00 oder 14:00 → 17:00"], ["Sonnenuntergang · 2 Std.", "1 Std. 15 Min. vor Sonnenuntergang, zurück 2 Std. später"], ["Sonnenuntergang · 2,5 Std.", "1 Std. 15 Min. vor Sonnenuntergang, zurück 2,5 Std. später"]],
    inK: "An Bord", inH: "Bei jeder Fahrt inklusive",
    inc: ["Das ganze Boot für Ihre Gruppe, bis zu 5 Gäste", "Zwei einheimische Skipper", "Essen an Bord, dazu lokaler Wein, Poncha, Bier und Softdrinks", "Ein Insta360-360°-Video, Drohnenaufnahmen von oben (wenn das Wetter es erlaubt) und hochwertige Fotos mit einer echten Kamera", "Eine Toilette an Bord", "Paddleboards und Baden auf der Tagestour"],
    bringK: "Mitbringen", bringH: "Leicht packen",
    bring: ["Badesachen und ein Handtuch für die Tagestour", "Sonnencreme und Sonnenbrille", "Eine leichte Jacke für die Sonnenuntergangstour", "Ihr Telefon, um den Steg zu finden"],
    polK: "Wetter und Stornierung", polH: "Wenn sich Pläne ändern",
    pol: ["Kostenlose Stornierung bis 24 Stunden vor der Abfahrt.", "Ist das Meer nicht sicher, sagen wir ab und Sie wählen ein anderes Datum oder erhalten den vollen Betrag zurück.", "Bezahlt wird per Karte für das ganze Boot, nie pro Person."],
    terms: "Vollständige Bedingungen lesen",
    askK: "Fragen", askH: "Schreiben Sie dem Skipper", wa: "WhatsApp", mail: "E-Mail",
    cta: "Verfügbarkeit prüfen",
  },
  pt: {
    title: "Informações práticas · Chifbay barco privado no Funchal",
    desc: "Ponto de encontro, horários, o que há a bordo e o que levar num passeio de barco privado Chifbay a partir da Marina do Funchal.",
    crumb: "Informações práticas", badge: "Antes de ir", h1: "Informações <em>práticas</em>",
    sub: "Onde nos encontramos, a que horas parte e regressa, o que há a bordo e o que levar.",
    meetK: "Ponto de encontro", meetH: "Marina do Funchal, junto ao pontão",
    meetP: "Todos os passeios partem da Marina do Funchal, no centro da marginal. O seu skipper espera por si no pontão. Chegue 15 minutos antes da partida.",
    maps: "Abrir no Google Maps",
    timesK: "Horários", timesH: "Partidas e regressos", timesNote: "Todas as horas são do Funchal. O passeio ao pôr do sol parte 1 h 15 antes do pôr do sol, arredondado ao quarto de hora anterior, para a luz estar certa todo o ano: a página de reserva mostra a hora exata do dia escolhido.",
    monthK: "Pôr do sol", monthH: "Horas de partida, mês a mês", monthTo: "a", monthNote: "A partida mais cedo e a mais tarde de cada mês, hora do Funchal. A hora segue o pôr do sol e a mudança de hora no fim de março e no fim de outubro.",
    rows: [["Passeio de dia · 2h30", "10:00 → 12:30 ou 14:00 → 16:30"], ["Passeio de dia · 3h", "10:00 → 13:00 ou 14:00 → 17:00"], ["Pôr do sol · 2h", "1 h 15 antes do pôr do sol, regresso 2 h depois"], ["Pôr do sol · 2h30", "1 h 15 antes do pôr do sol, regresso 2 h 30 depois"]],
    inK: "A bordo", inH: "Incluído em todos os passeios",
    inc: ["O barco inteiro para o seu grupo, até 5 pessoas", "Dois skippers locais", "Comida a bordo, com vinho local, poncha, cerveja e refrigerantes", "Um vídeo 360° Insta360, imagens de drone vistas de cima (se o tempo permitir) e fotos de qualidade tiradas com uma câmara a sério", "Casa de banho a bordo", "Pranchas de paddle e banhos no passeio de dia"],
    bringK: "O que levar", bringH: "Leve pouco",
    bring: ["Fato de banho e toalha para o passeio de dia", "Protetor solar e óculos de sol", "Um casaco leve para o pôr do sol", "O seu telemóvel, para encontrar o pontão"],
    polK: "Meteorologia e cancelamento", polH: "Se os planos mudarem",
    pol: ["Cancelamento gratuito até 24 horas antes da partida.", "Se o mar não estiver seguro cancelamos, e escolhe outra data ou recebe o reembolso total.", "O pagamento é por cartão, pelo barco inteiro, nunca por pessoa."],
    terms: "Ler os termos completos",
    askK: "Perguntas", askH: "Fale com o skipper", wa: "WhatsApp", mail: "Email",
    cta: "Ver disponibilidade",
  },
  es: {
    title: "Información práctica · Chifbay barco privado en Funchal",
    desc: "Punto de encuentro, horarios, qué hay a bordo y qué llevar en una salida en barco privado Chifbay desde la Marina do Funchal.",
    crumb: "Información práctica", badge: "Antes de salir", h1: "Información <em>práctica</em>",
    sub: "Dónde quedamos, a qué hora sales y vuelves, qué hay a bordo y qué llevar.",
    meetK: "Punto de encuentro", meetH: "Marina do Funchal, junto al pantalán",
    meetP: "Todas las salidas parten de la Marina do Funchal, en pleno paseo marítimo. Tu patrón te espera en el pantalán. Llega 15 minutos antes de la salida.",
    maps: "Abrir en Google Maps",
    timesK: "Horarios", timesH: "Salidas y regresos", timesNote: "Todas las horas son de Funchal. La salida al atardecer sale 1 h 15 antes de la puesta de sol, redondeado al cuarto de hora anterior, para tener la buena luz todo el año: la página de reserva muestra la hora exacta del día que elijas.",
    monthK: "Atardecer", monthH: "Horas de salida, mes a mes", monthTo: "a", monthNote: "La salida más temprana y la más tardía de cada mes, hora de Funchal. La hora sigue la puesta de sol y el cambio de hora de finales de marzo y de octubre.",
    rows: [["Salida de día · 2h30", "10:00 → 12:30 o 14:00 → 16:30"], ["Salida de día · 3h", "10:00 → 13:00 o 14:00 → 17:00"], ["Atardecer · 2h", "1 h 15 antes de la puesta de sol, vuelta 2 h después"], ["Atardecer · 2h30", "1 h 15 antes de la puesta de sol, vuelta 2 h 30 después"]],
    inK: "A bordo", inH: "Incluido en cada salida",
    inc: ["Todo el barco para tu grupo, hasta 5 personas", "Dos patrones locales", "Comida a bordo, con vino local, poncha, cerveza y refrescos", "Un vídeo 360° Insta360, imágenes de dron desde arriba (si el tiempo lo permite) y fotos de calidad hechas con una cámara de verdad", "Baño a bordo", "Tablas de paddle y baño en la salida de día"],
    bringK: "Qué llevar", bringH: "Viaja ligero",
    bring: ["Bañador y toalla para la salida de día", "Crema solar y gafas de sol", "Una chaqueta ligera para el atardecer", "Tu móvil, para encontrar el pantalán"],
    polK: "Tiempo y cancelación", polH: "Si cambian los planes",
    pol: ["Cancelación gratuita hasta 24 horas antes de la salida.", "Si el mar no es seguro cancelamos, y eliges otra fecha o te devolvemos todo.", "El pago es con tarjeta, por todo el barco, nunca por persona."],
    terms: "Leer las condiciones completas",
    askK: "Preguntas", askH: "Habla con el patrón", wa: "WhatsApp", mail: "Email",
    cta: "Ver disponibilidad",
  },
  it: {
    title: "Informazioni pratiche · Chifbay barca privata a Funchal",
    desc: "Punto d'incontro, orari, cosa c'è a bordo e cosa portare per un'uscita in barca privata Chifbay dalla Marina do Funchal.",
    crumb: "Informazioni pratiche", badge: "Prima di partire", h1: "Informazioni <em>pratiche</em>",
    sub: "Dove ci troviamo, a che ora si parte e si rientra, cosa c'è a bordo e cosa portare.",
    meetK: "Punto d'incontro", meetH: "Marina do Funchal, lato pontile",
    meetP: "Ogni uscita parte dalla Marina do Funchal, in pieno lungomare. Il vostro skipper vi aspetta sul pontile. Arrivate 15 minuti prima della partenza.",
    maps: "Apri in Google Maps",
    timesK: "Orari", timesH: "Partenze e rientri", timesNote: "Tutti gli orari sono di Funchal. L'uscita al tramonto parte 1 h 15 prima del tramonto, arrotondato al quarto d'ora inferiore, così la luce è giusta tutto l'anno: la pagina di prenotazione mostra l'orario esatto del giorno scelto.",
    monthK: "Tramonto", monthH: "Orari di partenza, mese per mese", monthTo: "a", monthNote: "La partenza più presto e più tardi di ogni mese, ora di Funchal. L'orario segue il tramonto e il cambio dell'ora a fine marzo e a fine ottobre.",
    rows: [["Uscita di giorno · 2h30", "10:00 → 12:30 o 14:00 → 16:30"], ["Uscita di giorno · 3h", "10:00 → 13:00 o 14:00 → 17:00"], ["Tramonto · 2h", "1 h 15 prima del tramonto, rientro 2 h dopo"], ["Tramonto · 2h30", "1 h 15 prima del tramonto, rientro 2 h 30 dopo"]],
    inK: "A bordo", inH: "Incluso in ogni uscita",
    inc: ["Tutta la barca per il vostro gruppo, fino a 5 ospiti", "Due skipper locali", "Cibo a bordo, con vino locale, poncha, birra e bibite", "Un video 360° Insta360, riprese con il drone dall'alto (meteo permettendo) e foto di qualità scattate con una vera fotocamera", "Un bagno a bordo", "Tavole da paddle e bagno nell'uscita di giorno"],
    bringK: "Cosa portare", bringH: "Viaggiate leggeri",
    bring: ["Costume e asciugamano per l'uscita di giorno", "Crema solare e occhiali da sole", "Una giacca leggera per il tramonto", "Il telefono, per trovare il pontile"],
    polK: "Meteo e cancellazione", polH: "Se i piani cambiano",
    pol: ["Cancellazione gratuita fino a 24 ore prima della partenza.", "Se il mare non è sicuro annulliamo, e scegliete un'altra data o ricevete il rimborso completo.", "Il pagamento è con carta, per tutta la barca, mai a persona."],
    terms: "Leggi le condizioni complete",
    askK: "Domande", askH: "Scrivete allo skipper", wa: "WhatsApp", mail: "Email",
    cta: "Verifica disponibilità",
  },
};

const esc = (s) => s.replace(/&(?!amp;|#)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");

// Sunset trip departures by month, from the rule in scripts/lib/sunset.mjs
// (1 h 15 before sunset, rounded down to the quarter hour). A fixed year so a
// second run writes the same page; the spread inside a month barely moves
// from one year to the next.
const MONTH_YEAR = 2027;
function months(lang, t) {
  const name = new Intl.DateTimeFormat(lang, { month: "long", timeZone: "UTC" });
  return departureRanges(MONTH_YEAR).map(({ month, from, to }) => {
    const m = name.format(new Date(Date.UTC(MONTH_YEAR, month - 1, 1)));
    const label = m.charAt(0).toUpperCase() + m.slice(1);
    return `<li><span>${esc(label)}</span><b>${from === to ? from : `${from} ${esc(t.monthTo)} ${to}`}</b></li>`;
  }).join("");
}

function main(t, lang) {
  const book = lang === "en" ? "/book" : `/book?lang=${lang}`;
  const terms = lang === "en" ? "/terms" : "/terms";
  return `<header class="hero sub">
  <div class="hbg" role="img" aria-label="${attr(t.meetH)}" style="background-image:url('/assets/g-champagne.jpg')"></div>
  <div class="hov"></div>
  <div class="wrap hc">
    <div class="hbadge rv in">${esc(t.badge)}</div>
    <h1 class="rv in">${t.h1}</h1>
    <p class="hsub rv in d1">${esc(t.sub)}</p>
  </div>
</header>

<section class="pad t-prac">
  <div class="wrap">
    <div class="t-pgrid">
      <article class="t-pcard t-pwide rv">
        <div class="eyebrow">${esc(t.meetK)}</div>
        <h2>${esc(t.meetH)}</h2>
        <p>${esc(t.meetP)}</p>
        <p class="t-paddr">Marina do Funchal, 9000-055 Funchal, Madeira, Portugal · 32.6442° N, 16.9165° W</p>
        <a class="btn btn-g" href="${MAPS}" target="_blank" rel="noopener">${esc(t.maps)}</a>
      </article>
      <article class="t-pcard t-pwide rv">
        <div class="eyebrow">${esc(t.timesK)}</div>
        <h2>${esc(t.timesH)}</h2>
        <table class="t-ptimes"><tbody>${t.rows.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
        <p class="t-pnote">${esc(t.timesNote)}</p>
      </article>
      <article class="t-pcard t-pwide rv">
        <div class="eyebrow">${esc(t.monthK)}</div>
        <h2>${esc(t.monthH)}</h2>
        <ul class="t-pmonths">${months(lang, t)}</ul>
        <p class="t-pnote">${esc(t.monthNote)}</p>
      </article>
      <article class="t-pcard rv">
        <div class="eyebrow">${esc(t.inK)}</div>
        <h2>${esc(t.inH)}</h2>
        <ul class="t-plist">${li(t.inc)}</ul>
      </article>
      <article class="t-pcard rv">
        <div class="eyebrow">${esc(t.bringK)}</div>
        <h2>${esc(t.bringH)}</h2>
        <ul class="t-plist">${li(t.bring)}</ul>
      </article>
      <article class="t-pcard rv">
        <div class="eyebrow">${esc(t.polK)}</div>
        <h2>${esc(t.polH)}</h2>
        <ul class="t-plist">${li(t.pol)}</ul>
        <a class="t-plink" href="${terms}">${esc(t.terms)}</a>
      </article>
      <article class="t-pcard rv">
        <div class="eyebrow">${esc(t.askK)}</div>
        <h2>${esc(t.askH)}</h2>
        <ul class="t-plist t-pcontact"><li>${esc(t.wa)} · <a href="https://wa.me/351937200320" target="_blank" rel="noopener">+351 937 200 320</a></li><li>${esc(t.mail)} · <a href="mailto:hello@chifbay.com">hello@chifbay.com</a></li></ul>
      </article>
    </div>
    <div class="center t-pcta"><a class="btn btn-p btn-lg" href="${book}">${esc(t.cta)}
      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
  </div>
</section>
`;
}

let n = 0;
for (const lang of LANGS) {
  const dir = lang === "en" ? "" : `${lang}/`;
  const base = `https://chifbay.com/${dir}`;
  const t = T[lang];
  let h = readFileSync(join(SITE, `${dir}contact.html`), "utf8");
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(t.desc)}">`);
  h = h.replace(/(<meta property="og:title" content=")[^"]*/, `$1${attr(t.title)}`);
  h = h.replace(/(<meta property="og:description" content=")[^"]*/, `$1${attr(t.desc)}`);
  h = h.replace(/(<meta property="og:url" content=")[^"]*/, `$1${base}practical`);
  // canonical, hreflang and the language menu: contact -> practical, nothing else
  h = h.replace(/(https:\/\/chifbay\.com\/(?:(?:fr|de|pt|es|it)\/)?)contact(\.html)?"/g, '$1practical"');
  h = h.replace(/(<div class="langmenu">[\s\S]*?<\/div>)/, (m) => m.replace(/href="(\/(?:(?:fr|de|pt|es|it)\/)?)contact(\.html)?"/g, 'href="$1practical"'));
  // structured data: a breadcrumb only (the contact FAQ belongs to the contact page)
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, "");
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Chifbay", item: base },
    { "@type": "ListItem", position: 2, name: t.crumb, item: `${base}practical` }] };
  h = h.replace(/<\/head>/, `<script type="application/ld+json">\n${JSON.stringify(crumbs)}\n</script>\n</head>`);
  // main content: from the hero to the footer
  const a = h.indexOf('<header class="hero sub'), b = h.indexOf("<footer");
  if (a < 0 || b < 0) throw new Error(`${dir}contact.html: hero or footer not found`);
  h = h.slice(0, a) + main(t, lang) + "\n" + h.slice(b);
  h = h.replace(/(<nav class="nl">[\s\S]*?<\/nav>)/, (m) => m.replace(/ class="active"( aria-current="page")?/g, "")
    .replace(/(<a href="\/(?:(?:fr|de|pt|es|it)\/)?practical")>/, '$1 class="active" aria-current="page">'));
  h = webpify(h, join(SITE, `${dir}practical.html`));   // same photo markup as scripts/use-webp.mjs
  if (WRITE) writeFileSync(join(SITE, `${dir}practical.html`), h);
  n++;
}

// sitemap: one entry per language, extensionless like the rest
const smPath = join(SITE, "sitemap.xml");
let sm = readFileSync(smPath, "utf8");
const add = LANGS.map((l) => `https://chifbay.com/${l === "en" ? "" : l + "/"}practical`).filter((u) => !sm.includes(`<loc>${u}</loc>`));
if (add.length) sm = sm.replace("</urlset>", add.map((u) => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`).join("\n") + "\n</urlset>");
if (WRITE) writeFileSync(smPath, sm);
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${n} practical page(s), ${add.length} sitemap entr${add.length === 1 ? "y" : "ies"} added`);
