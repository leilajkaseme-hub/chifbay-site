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
    timesK: "Times", timesH: "Departures and returns", timesNote: "All times are Funchal time. The sunset moves through the year, from about 18:05 in December to 21:15 in June: the booking page shows the sunset for the day you pick.",
    rows: [["Day trip · 2h30", "10:00 → 12:30 or 14:00 → 16:30"], ["Day trip · 3h", "10:00 → 13:00 or 14:00 → 17:00"], ["Sunset trip · 2h", "18:30 → 20:30"], ["Sunset trip · 2h30", "18:30 → 21:00"]],
    inK: "On board", inH: "Included in every trip",
    inc: ["The whole boat for your group, up to 5 guests", "Two local skippers", "Local wine, poncha, beer, soft drinks and snacks", "Drone footage, an Insta360 video and photos of your trip", "A bathroom on board", "Paddle boards and swimming on the day trip"],
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
    timesK: "Horaires", timesH: "Départs et retours", timesNote: "Toutes les heures sont celles de Funchal. Le coucher du soleil change au fil de l'année, d'environ 18:05 en décembre à 21:15 en juin : la page de réservation l'affiche pour le jour choisi.",
    rows: [["Sortie de jour · 2h30", "10:00 → 12:30 ou 14:00 → 16:30"], ["Sortie de jour · 3h", "10:00 → 13:00 ou 14:00 → 17:00"], ["Coucher de soleil · 2h", "18:30 → 20:30"], ["Coucher de soleil · 2h30", "18:30 → 21:00"]],
    inK: "À bord", inH: "Compris dans chaque sortie",
    inc: ["Tout le bateau pour votre groupe, jusqu'à 5 personnes", "Deux skippers locaux", "Vin local, poncha, bière, sodas et en-cas", "Images de drone, une vidéo Insta360 et des photos de votre sortie", "Des toilettes à bord", "Paddles et baignade pendant la sortie de jour"],
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
    timesK: "Zeiten", timesH: "Abfahrt und Rückkehr", timesNote: "Alle Zeiten sind Ortszeit Funchal. Der Sonnenuntergang wandert übers Jahr, von etwa 18:05 im Dezember bis 21:15 im Juni: die Buchungsseite zeigt ihn für Ihren Tag.",
    rows: [["Tagestour · 2,5 Std.", "10:00 → 12:30 oder 14:00 → 16:30"], ["Tagestour · 3 Std.", "10:00 → 13:00 oder 14:00 → 17:00"], ["Sonnenuntergang · 2 Std.", "18:30 → 20:30"], ["Sonnenuntergang · 2,5 Std.", "18:30 → 21:00"]],
    inK: "An Bord", inH: "Bei jeder Fahrt inklusive",
    inc: ["Das ganze Boot für Ihre Gruppe, bis zu 5 Gäste", "Zwei einheimische Skipper", "Lokaler Wein, Poncha, Bier, Softdrinks und Snacks", "Drohnenaufnahmen, ein Insta360 Video und Fotos Ihrer Fahrt", "Eine Toilette an Bord", "Paddleboards und Baden auf der Tagestour"],
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
    timesK: "Horários", timesH: "Partidas e regressos", timesNote: "Todas as horas são do Funchal. O pôr do sol muda ao longo do ano, de cerca das 18:05 em dezembro às 21:15 em junho: a página de reserva mostra-o para o dia escolhido.",
    rows: [["Passeio de dia · 2h30", "10:00 → 12:30 ou 14:00 → 16:30"], ["Passeio de dia · 3h", "10:00 → 13:00 ou 14:00 → 17:00"], ["Pôr do sol · 2h", "18:30 → 20:30"], ["Pôr do sol · 2h30", "18:30 → 21:00"]],
    inK: "A bordo", inH: "Incluído em todos os passeios",
    inc: ["O barco inteiro para o seu grupo, até 5 pessoas", "Dois skippers locais", "Vinho local, poncha, cerveja, refrigerantes e petiscos", "Imagens de drone, um vídeo Insta360 e fotos do seu passeio", "Casa de banho a bordo", "Pranchas de paddle e banhos no passeio de dia"],
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
    timesK: "Horarios", timesH: "Salidas y regresos", timesNote: "Todas las horas son de Funchal. La puesta de sol cambia durante el año, de unas 18:05 en diciembre a las 21:15 en junio: la página de reserva la muestra para el día que elijas.",
    rows: [["Salida de día · 2h30", "10:00 → 12:30 o 14:00 → 16:30"], ["Salida de día · 3h", "10:00 → 13:00 o 14:00 → 17:00"], ["Atardecer · 2h", "18:30 → 20:30"], ["Atardecer · 2h30", "18:30 → 21:00"]],
    inK: "A bordo", inH: "Incluido en cada salida",
    inc: ["Todo el barco para tu grupo, hasta 5 personas", "Dos patrones locales", "Vino local, poncha, cerveza, refrescos y picoteo", "Imágenes de dron, un vídeo Insta360 y fotos de tu salida", "Baño a bordo", "Tablas de paddle y baño en la salida de día"],
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
    timesK: "Orari", timesH: "Partenze e rientri", timesNote: "Tutti gli orari sono di Funchal. Il tramonto cambia durante l'anno, da circa le 18:05 a dicembre alle 21:15 a giugno: la pagina di prenotazione lo mostra per il giorno scelto.",
    rows: [["Uscita di giorno · 2h30", "10:00 → 12:30 o 14:00 → 16:30"], ["Uscita di giorno · 3h", "10:00 → 13:00 o 14:00 → 17:00"], ["Tramonto · 2h", "18:30 → 20:30"], ["Tramonto · 2h30", "18:30 → 21:00"]],
    inK: "A bordo", inH: "Incluso in ogni uscita",
    inc: ["Tutta la barca per il vostro gruppo, fino a 5 ospiti", "Due skipper locali", "Vino locale, poncha, birra, bibite e stuzzichini", "Riprese con drone, un video Insta360 e foto della vostra uscita", "Un bagno a bordo", "Tavole da paddle e bagno nell'uscita di giorno"],
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
  h = h.replace(/(<nav class="nl">[\s\S]*?<\/nav>)/, (m) => m.replace(/ class="active"/g, ""));
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
