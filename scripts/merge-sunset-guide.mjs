#!/usr/bin/env node
// merge-sunset-guide.mjs: the Journal guide /posts/sunset-cruise-madeira-guide
// becomes part of the sales page /sunset-cruise, in the six languages.
//
//   node scripts/merge-sunset-guide.mjs           dry run
//   node scripts/merge-sunset-guide.mjs --write   apply   (safe to run again)
//
// Why: Search Console (3 months to 31 Oct 2026) shows the guide, not the sales
// page, for "sunset cruise funchal" (8th) and "sunset cruise madeira" (9th).
// Two pages of one site answer the same search and pull each other down.
//
// What it does:
//   1. sunset-cruise.html and fr/ de/ pt/ es/ it/ copies: a "When to go"
//      section (sunset and departure times by season, from scripts/lib/sunset.mjs)
//      before the questions, and three new questions (boat or viewpoint, what to
//      bring, how far ahead to book), on the page and in its FAQPage JSON-LD.
//   2. The guide stays on disk (no article is deleted) but points at the sales
//      page: canonical, meta refresh 0, location.replace, a visible link. GitHub
//      Pages cannot send a 301, Google reads a 0 second refresh as one.
//   3. The guide leaves posts/posts.json (so the Journal list, the translator and
//      the writer stop treating it as a live article) and sitemap.xml.
//   4. Every link to the guide (pages and queued drafts) goes to /sunset-cruise.
// Then run: node scripts/build-blog-index.mjs (the Journal lists in 6 languages).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SLUG = "sunset-cruise-madeira-guide";
const GUIDE = `posts/${SLUG}.html`;
const TARGET = "https://chifbay.com/sunset-cruise";

const ICON = {
  sun: `<svg class="ic" viewBox="0 0 32 32"><circle cx="16" cy="16" r="5"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M7.5 24.5l2.8-2.8M21.7 10.3l2.8-2.8"/></svg>`,
  dusk: `<svg class="ic" viewBox="0 0 32 32"><path d="M4 22h24M8 22a8 8 0 0 1 16 0M16 7v4M7.5 12.5l2.5 2.5M24.5 12.5L22 15M10 27h12"/></svg>`,
  cloud: `<svg class="ic" viewBox="0 0 32 32"><path d="M9 23h14a5 5 0 0 0 .6-10A7.5 7.5 0 0 0 9.2 15 4 4 0 0 0 9 23z"/></svg>`,
};

// Times: scripts/lib/sunset.mjs (sunset 18:01 on 2 Dec, 21:19 on 21 Jun; departure
// 19:15 to 20:00 in Jun to Aug, about 19:00 on 1 Apr, 17:00 after 25 Oct, 16:45 to
// 17:45 in Nov to Feb). Never "18:00" or "18:30" next to the word sunset:
// scripts/checks/policy.test.mjs refuses a fixed sunset departure.
const T = {
  "": {
    label: "When to go", h2: "Sunset times, season by season",
    lead: "In Funchal the sun goes down at about 6 pm in early December and close to 9:20 pm in late June. We always cast off 1 h 15 before it, so every season gets the full show, just at a different hour.",
    cards: [
      ["sun", "June to August", "The longest, warmest evenings. We leave between 19:15 and 20:00 and come home under the first lights of Funchal. Evening slots go first in July and August, so book a few days ahead."],
      ["dusk", "Spring and autumn", "April, May, September and October: quieter months, the same light. The departure moves with the sun, from about 19:00 in April to 17:00 once the clocks go back in late October."],
      ["cloud", "November to February", "Short days, early start: we leave between 16:45 and 17:45 and you are back in time for dinner. Winter sunsets can be just as striking, so bring a warm layer for the run home."],
    ],
    faq: [
      ["Is a boat better than a viewpoint for the sunset?", "From the water nothing stands between you and the horizon: no rooftops, no trees, and the colour comes back at you off the sea. The skipper can also move the boat in the last minutes to keep the sun and the coast in one frame, with Cabo Girão, Câmara de Lobos or the Funchal skyline behind you. A viewpoint on land stays where it is."],
      ["What should we bring?", "A light jacket or a wrap: it gets cooler once the sun is down, and there is usually a breeze at sea, even on a calm evening. Add sunglasses, sunscreen (the sun on the water is stronger than it feels) and shoes with a grip sole rather than flip-flops. Drinks and food are on board."],
      ["How far ahead should we book?", "In July and August, a few days ahead: evening slots fill first. The rest of the year, dates close to the day are usually easier to find. The booking calendar shows the free dates and the exact departure time."],
    ],
  },
  fr: {
    label: "Quand partir", h2: "Le coucher du soleil, saison par saison",
    lead: "À Funchal, le soleil se couche vers 18 h début décembre et vers 21 h 20 fin juin. Nous partons toujours 1 h 15 avant : chaque saison a droit au même spectacle, simplement à une autre heure.",
    cards: [
      ["sun", "De juin à août", "Les soirées les plus longues et les plus douces. Départ entre 19h15 et 20h00, retour sous les premières lumières de Funchal. En juillet et en août, les créneaux du soir partent en premier : réservez quelques jours à l'avance."],
      ["dusk", "Printemps et automne", "Avril, mai, septembre et octobre : des mois plus calmes, la même lumière. L'heure de départ suit le soleil, d'environ 19h00 en avril à 17h00 après le changement d'heure de fin octobre."],
      ["cloud", "De novembre à février", "Journées courtes, départ tôt : entre 16h45 et 17h45, et vous êtes rentrés pour le dîner. Les couchers de soleil d'hiver peuvent être tout aussi beaux, prévoyez une couche chaude pour le retour."],
    ],
    faq: [
      ["Vaut-il mieux voir le coucher du soleil en bateau ou depuis un belvédère ?", "En mer, rien ne vous sépare de l'horizon : ni toits, ni arbres, et la couleur se reflète sur l'eau tout autour. Le skipper peut aussi déplacer le bateau dans les dernières minutes pour garder le soleil et la côte dans le même cadre, avec Cabo Girão, Câmara de Lobos ou Funchal derrière vous. Un belvédère, lui, ne bouge pas."],
      ["Que faut-il apporter ?", "Une veste légère ou un châle : il fait plus frais une fois le soleil couché, et il y a souvent de la brise en mer, même par une soirée calme. Ajoutez des lunettes de soleil, de la crème solaire (le soleil sur l'eau tape plus fort qu'on ne le croit) et des chaussures qui accrochent plutôt que des tongs. Boissons et repas sont à bord."],
      ["Combien de temps à l'avance faut-il réserver ?", "En juillet et en août, quelques jours avant : les créneaux du soir partent en premier. Le reste de l'année, une date proche se trouve en général plus facilement. Le calendrier de réservation affiche les dates libres et l'heure exacte du départ."],
    ],
  },
  de: {
    label: "Die beste Zeit", h2: "Sonnenuntergang, Jahreszeit für Jahreszeit",
    lead: "In Funchal geht die Sonne Anfang Dezember gegen 18 Uhr unter und Ende Juni erst gegen 21:20 Uhr. Wir legen immer 1 Std. 15 Min. vorher ab: Jede Jahreszeit bekommt dasselbe Schauspiel, nur zu einer anderen Uhrzeit.",
    cards: [
      ["sun", "Juni bis August", "Die längsten und wärmsten Abende. Abfahrt zwischen 19:15 und 20:00 Uhr, zurück, wenn in Funchal die ersten Lichter angehen. Im Juli und August sind die Abendtermine zuerst weg, buchen Sie also ein paar Tage im Voraus."],
      ["dusk", "Frühling und Herbst", "April, Mai, September und Oktober: ruhigere Monate, dasselbe Licht. Die Abfahrt wandert mit der Sonne, von etwa 19:00 Uhr im April bis 17:00 Uhr nach der Zeitumstellung Ende Oktober."],
      ["cloud", "November bis Februar", "Kurze Tage, früher Start: Abfahrt zwischen 16:45 und 17:45 Uhr, zum Abendessen sind Sie zurück. Auch Sonnenuntergänge im Winter können spektakulär sein, nehmen Sie für die Rückfahrt eine warme Jacke mit."],
    ],
    faq: [
      ["Ist der Sonnenuntergang vom Boot schöner als von einem Aussichtspunkt?", "Auf dem Wasser steht nichts zwischen Ihnen und dem Horizont: keine Dächer, keine Bäume, und das Meer wirft die Farben zurück. Der Skipper kann das Boot in den letzten Minuten auch so drehen, dass Sonne und Küste in einem Bild bleiben, mit Cabo Girão, Câmara de Lobos oder Funchal im Hintergrund. Ein Aussichtspunkt an Land bleibt, wo er ist."],
      ["Was sollten wir mitbringen?", "Eine leichte Jacke oder ein Tuch: Nach Sonnenuntergang wird es kühler, und auf See weht fast immer eine Brise, auch an ruhigen Abenden. Dazu Sonnenbrille, Sonnencreme (die Sonne auf dem Wasser ist stärker, als man denkt) und Schuhe mit griffiger Sohle statt Flip-Flops. Getränke und Essen gibt es an Bord."],
      ["Wie früh sollten wir buchen?", "Im Juli und August ein paar Tage im Voraus: Die Abendtermine sind zuerst ausgebucht. Im Rest des Jahres findet man kurzfristig meist leichter einen Termin. Der Buchungskalender zeigt die freien Tage und die genaue Abfahrtszeit."],
    ],
  },
  pt: {
    label: "Quando ir", h2: "O pôr do sol, estação a estação",
    lead: "No Funchal, o sol põe-se por volta das 18h no início de dezembro e perto das 21h20 no fim de junho. Largamos sempre 1 h 15 antes, por isso todas as estações têm o mesmo espetáculo, só que a outra hora.",
    cards: [
      ["sun", "Junho a agosto", "As noites mais longas e mais quentes. Partida entre as 19:15 e as 20:00, regresso com as primeiras luzes do Funchal. Em julho e agosto, os horários do fim do dia são os primeiros a esgotar: reserve com alguns dias de antecedência."],
      ["dusk", "Primavera e outono", "Abril, maio, setembro e outubro: meses mais calmos, a mesma luz. A hora de partida acompanha o sol, de cerca das 19:00 em abril até às 17:00 depois da mudança da hora, no fim de outubro."],
      ["cloud", "Novembro a fevereiro", "Dias curtos, saída cedo: partimos entre as 16:45 e as 17:45 e está de volta a tempo do jantar. Os pores do sol de inverno podem ser igualmente bonitos, por isso traga um agasalho para o regresso."],
    ],
    faq: [
      ["Vale mais a pena ver o pôr do sol de barco ou de um miradouro?", "No mar, nada se põe entre o barco e o horizonte: nem telhados, nem árvores, e a cor reflete-se na água à sua volta. O skipper pode ainda mudar a posição do barco nos últimos minutos para manter o sol e a costa no mesmo enquadramento, com o Cabo Girão, Câmara de Lobos ou o Funchal ao fundo. Um miradouro em terra fica onde está."],
      ["O que devemos levar?", "Um casaco leve ou um xaile: arrefece depois de o sol se pôr e no mar há quase sempre uma brisa, mesmo numa noite calma. Leve também óculos de sol, protetor solar (o sol na água é mais forte do que parece) e calçado com sola aderente em vez de chinelos. As bebidas e a comida estão a bordo."],
      ["Com quanta antecedência devemos reservar?", "Em julho e agosto, com alguns dias: os horários do fim do dia esgotam primeiro. No resto do ano é, em geral, mais fácil encontrar data em cima da hora. O calendário de reservas mostra os dias livres e a hora exata de partida."],
    ],
  },
  es: {
    label: "Cuándo ir", h2: "La puesta de sol, estación a estación",
    lead: "En Funchal el sol se pone hacia las 18 h a principios de diciembre y cerca de las 21:20 a finales de junio. Salimos siempre 1 h 15 antes, así que cada estación tiene el mismo espectáculo, solo que a otra hora.",
    cards: [
      ["sun", "De junio a agosto", "Las tardes más largas y cálidas. Salida entre las 19:15 y las 20:00, vuelta con las primeras luces de Funchal. En julio y agosto las salidas de tarde se llenan primero: reserva con unos días de antelación."],
      ["dusk", "Primavera y otoño", "Abril, mayo, septiembre y octubre: meses más tranquilos, la misma luz. La hora de salida sigue al sol, de unas 19:00 en abril a las 17:00 tras el cambio de hora de finales de octubre."],
      ["cloud", "De noviembre a febrero", "Días cortos, salida temprana: entre las 16:45 y las 17:45, y estás de vuelta para cenar. Los atardeceres de invierno pueden ser igual de bonitos, así que trae algo de abrigo para la vuelta."],
    ],
    faq: [
      ["¿Es mejor ver el atardecer desde un barco o desde un mirador?", "Desde el mar no hay nada entre ti y el horizonte: ni tejados ni árboles, y el color se refleja en el agua a tu alrededor. El skipper también puede mover el barco en los últimos minutos para mantener el sol y la costa en el mismo encuadre, con Cabo Girão, Câmara de Lobos o Funchal al fondo. Un mirador en tierra no se mueve."],
      ["¿Qué debemos llevar?", "Una chaqueta ligera o un pañuelo grande: refresca cuando se pone el sol y en el mar casi siempre corre brisa, incluso en una tarde tranquila. Añade gafas de sol, crema solar (el sol sobre el agua pega más de lo que parece) y calzado con suela que agarre en lugar de chanclas. Bebidas y comida van a bordo."],
      ["¿Con cuánta antelación hay que reservar?", "En julio y agosto, con unos días: las salidas de tarde se llenan primero. El resto del año suele ser más fácil encontrar fecha a última hora. El calendario de reservas muestra los días libres y la hora exacta de salida."],
    ],
  },
  it: {
    label: "Quando andare", h2: "Il tramonto, stagione per stagione",
    lead: "A Funchal il sole tramonta verso le 18 a inizio dicembre e verso le 21:20 a fine giugno. Partiamo sempre 1 h 15 prima, così ogni stagione ha lo stesso spettacolo, solo a un'altra ora.",
    cards: [
      ["sun", "Da giugno ad agosto", "Le serate più lunghe e calde. Partenza tra le 19:15 e le 20:00, rientro con le prime luci di Funchal. A luglio e agosto le uscite serali finiscono per prime: prenotate qualche giorno prima."],
      ["dusk", "Primavera e autunno", "Aprile, maggio, settembre e ottobre: mesi più tranquilli, la stessa luce. L'orario di partenza segue il sole, da circa le 19:00 ad aprile alle 17:00 dopo il cambio dell'ora di fine ottobre."],
      ["cloud", "Da novembre a febbraio", "Giornate corte, partenza presto: tra le 16:45 e le 17:45, e si rientra in tempo per cena. Anche i tramonti d'inverno possono essere splendidi, quindi portate qualcosa di caldo per il ritorno."],
    ],
    faq: [
      ["Meglio vedere il tramonto dalla barca o da un belvedere?", "Dal mare niente si mette tra voi e l'orizzonte: niente tetti, niente alberi, e il colore si riflette sull'acqua tutto intorno. Lo skipper può anche spostare la barca negli ultimi minuti per tenere il sole e la costa nella stessa inquadratura, con Cabo Girão, Câmara de Lobos o Funchal alle vostre spalle. Un belvedere sulla terraferma resta dov'è."],
      ["Cosa dobbiamo portare?", "Una giacca leggera o uno scialle: dopo il tramonto rinfresca e in mare c'è quasi sempre un po' di brezza, anche nelle serate calme. Poi occhiali da sole, crema solare (il sole sull'acqua è più forte di quanto sembri) e scarpe con suola antiscivolo invece delle infradito. Bevande e cibo sono a bordo."],
      ["Con quanto anticipo bisogna prenotare?", "A luglio e agosto, qualche giorno prima: le uscite serali si riempiono per prime. Nel resto dell'anno è più facile trovare una data all'ultimo momento. Il calendario delle prenotazioni mostra i giorni liberi e l'orario esatto di partenza."],
    ],
  },
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const changes = new Map();
const put = (rel, html) => { if (html !== read(rel)) changes.set(rel, html); };

// ---------------------------------------------------------------- 1. sales pages
const START = "<!-- sunset:when -->", END = "<!-- /sunset:when -->";
const FAQ_START = "<!-- sunset:faq -->", FAQ_END = "<!-- /sunset:faq -->";
const FAQ_RE = /<script type="application\/ld\+json">\n?(\{"@context":"https:\/\/schema\.org","@type":"FAQPage"[\s\S]*?)\n?<\/script>/;

for (const [lang, t] of Object.entries(T)) {
  const own = JSON.stringify(t);
  if (/[–—]/.test(own)) throw new Error(`${lang}: en or em dash in new text`);
  if (/golden hour|heure dorée|goldene[nr]? Stunde|hora dourada|hora dorada|ora d.oro/i.test(own)) throw new Error(`${lang}: golden hour promise`);
  const rel = `${lang ? lang + "/" : ""}sunset-cruise.html`;
  let h = read(rel);

  const section = `${START}
<section class="chapter" style="padding-top:0" id="when">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cn">05</span><span class="cl">${t.label}</span></div>
    <h2 class="display reveal" data-mask style="font-size:clamp(1.9rem,3.6vw,3rem);margin-bottom:10px">${t.h2}</h2>
    <p class="reveal d1" style="max-width:56ch;color:var(--mist)">${t.lead}</p>
  </div>
</section>

<section>
  <div class="wrap-w">
    <div class="feat">
${t.cards.map(([ic, h3, p], i) => `      <div class="ft reveal${i ? ` d${i}` : ""}">
        ${ICON[ic]}
        <h3>${h3}</h3>
        <p>${p}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>
${END}

`;
  if (h.includes(START)) {
    h = h.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n\\n`), section);
  } else {
    // before the questions, which become chapter 06
    const faqHead = /<section class="chapter" style="padding-top:0">\n  <div class="wrap-w">\n    <div class="chead reveal"><span class="cn">05<\/span>/;
    if (!faqHead.test(h)) throw new Error(`${rel}: no chapter 05 (questions) to insert before`);
    h = h.replace(faqHead, (m) => section + m.replace('<span class="cn">05</span>', '<span class="cn">06</span>'));
  }

  // the questions, on the page
  const items = t.faq.map(([q, a]) => `      <details class="reveal"><summary>${q}<span class="fi">+</span></summary><p class="fb">${a}</p></details>`).join("\n");
  const block = `${FAQ_START}\n${items}\n      ${FAQ_END}`;
  if (h.includes(FAQ_START)) h = h.replace(new RegExp(`${FAQ_START}[\\s\\S]*?${FAQ_END}`), block);
  else {
    const at = h.indexOf('<div class="faq">');
    const end = at < 0 ? -1 : h.indexOf("\n    </div>\n  </div>\n</section>", at);
    if (end < 0) throw new Error(`${rel}: no FAQ list`);
    h = h.slice(0, end) + "\n      " + block + h.slice(end);
  }

  // the same questions in FAQPage JSON-LD (replaced by question text, so a second run adds nothing)
  const m = h.match(FAQ_RE);
  if (!m) throw new Error(`${rel}: no FAQPage JSON-LD`);
  const data = JSON.parse(m[1]);
  const names = new Set(t.faq.map(([q]) => q));
  data.mainEntity = data.mainEntity.filter((x) => !names.has(x.name))
    .concat(t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })));
  h = h.replace(m[1], JSON.stringify(data));
  put(rel, h);
}

// ---------------------------------------------------------------- 2. the guide
{
  let h = read(GUIDE);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${TARGET}"/>`);
  if (!/<meta property="og:url"/.test(h)) h = h.replace(/(<link rel="canonical"[^>]*>)/, `$1\n<meta property="og:url" content="${TARGET}"/>`);
  // the hreflang set and the FAQ / article JSON-LD described a page that now forwards
  h = h.replace(/<!--hreflang:posts-i18n-->[\s\S]*?<!--\/hreflang:posts-i18n-->\n?/, "");
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  const go = `<meta http-equiv="refresh" content="0; url=/sunset-cruise"/>\n<script>location.replace("/sunset-cruise"+location.search+location.hash)</script>\n`;
  if (!h.includes('http-equiv="refresh"')) h = h.replace(/(<meta name="viewport"[^>]*>\n)/, `$1${go}`);
  const note = `<p class="lede" data-moved><strong>This guide is now part of our sunset cruise page</strong>, with sunset times by season, what to bring and how far ahead to book: <a href="/sunset-cruise">Sunset cruise in Funchal, Madeira</a>.</p>\n      `;
  if (!h.includes("data-moved")) h = h.replace(/(<article class="article[^"]*">\n\s*)/, `$1${note}`);
  if (!h.includes("data-moved") || !h.includes('http-equiv="refresh"')) throw new Error(`${GUIDE}: markers not found`);
  put(GUIDE, h);
}

// ---------------------------------------------------------------- 3. posts.json, sitemap
{
  const rel = "posts/posts.json";
  const posts = JSON.parse(read(rel));
  const kept = posts.filter((p) => p.slug !== SLUG);
  if (kept.length !== posts.length) put(rel, JSON.stringify(kept, null, 2) + "\n");
  for (const lang of ["fr", "de", "pt", "es", "it"]) {
    const f = `${lang}/posts/posts.json`;
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const rows = JSON.parse(read(f));
    const k = rows.filter((p) => p.slug !== SLUG);
    if (k.length !== rows.length) put(f, JSON.stringify(k, null, 2) + "\n");
  }
  const sm = read("sitemap.xml");
  put("sitemap.xml", sm.replace(new RegExp(`[ \\t]*<url><loc>https://chifbay\\.com/posts/${SLUG}(?:\\.html)?</loc>.*?</url>\\n`, "g"), ""));
}

// ---------------------------------------------------------------- 4. links to the guide
const SKIP = new Set([".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "scripts", "assets"]);
const LINK = new RegExp(`(href=")(?:https://chifbay\\.com)?(?:\\.\\./)*/?posts/${SLUG}(?:\\.html)?(?=["#?])`, "g");
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) { walk(rel); continue; }
    if (!/\.(html|draft)$/.test(e.name) || rel === GUIDE) continue;
    const before = changes.get(rel) ?? read(rel);
    if (!before.includes(SLUG)) continue;
    let h = before.replace(LINK, "$1/sunset-cruise");
    // the one queued draft that sends readers to the guide for timing
    h = h.replace(`Our guide to the <a href="/sunset-cruise">best light on a sunset cruise in Madeira</a> goes into timing in more detail.`,
      `Our <a href="/sunset-cruise">sunset cruise page</a> gives the departure time for each season.`);
    if (h !== before) changes.set(rel, h);
  }
})("");

for (const [rel, html] of changes) {
  console.log(`${WRITE ? "write" : "would write"}: ${rel}`);
  if (WRITE) fs.writeFileSync(path.join(ROOT, rel), html);
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changes.size} file(s).`);
