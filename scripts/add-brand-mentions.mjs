#!/usr/bin/env node
// add-brand-mentions.mjs: puts the name "Chifbay" in the sentences AI answers copy from our pages.
//
//   node scripts/add-brand-mentions.mjs           dry run (prints what would change)
//   node scripts/add-brand-mentions.mjs --write   applies it
//
// Why (18 Oct 2026): Semrush AI Visibility showed 48 citations of chifbay.com and 0 mentions. The cited
// passages said "we" and "our boat": an AI answer can quote them without ever naming us. So:
//   1. Guides articles (posts/ and <lang>/posts/): a "By Chifbay" line in the article meta, a short
//      "About Chifbay" box after the article, and the JSON-LD author linked to our business.
//   2. The sunset and day trip pages (6 languages): the first hero sentence and the first FAQ answer
//      (visible and JSON-LD) name Chifbay.
//   3. Home pages (6 languages): three FAQ answers (price, what is included, departure point) name Chifbay.
//   4. About pages (6 languages): the "since 2019" claims and "Rated on Airbnb" go; they contradicted
//      everything else (company, licence and boat are from 2026; reviews are Google, GetYourGuide, Tripadvisor).
// Safe to run again: the byline and the box are rebuilt in the page's own language, the text edits only
// apply where the old wording is still there. Run after anything that writes or translates articles.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const LANGS = ["en", "fr", "de", "pt", "es", "it"];
const pre = (l) => (l === "en" ? "" : `${l}/`);
const BIZ = "https://chifbay.com/#business";
// prices in the box: keep equal to booking-api/catalog.js (sunset 2 h, day trip 2 h 30)
const SUNSET = 400, DAY = 500;

const BOX = {
  en: { by: "By", h: "About Chifbay", t: `Chifbay runs private boat trips in Madeira from Marina do Funchal, Pontoon C: one boat, one group at a time, up to 5 guests, with two local skippers. Day trips with a swim at Fajã dos Padres from €${DAY} and sunset cruises from €${SUNSET}, for the whole boat. Licensed maritime tourism operator (RNAAT 305/2026).`, a: "Our story", b: "The trips" },
  fr: { by: "Par", h: "À propos de Chifbay", t: `Chifbay propose des sorties privées en bateau à Madère depuis la Marina do Funchal, ponton C : un seul bateau, un seul groupe à la fois, jusqu'à 5 personnes, avec deux skippers locaux. Sortie à la journée avec baignade à la Fajã dos Padres dès ${DAY} €, coucher de soleil dès ${SUNSET} €, prix pour tout le bateau. Opérateur de tourisme maritime agréé (RNAAT 305/2026).`, a: "Notre histoire", b: "Les sorties" },
  de: { by: "Von", h: "Über Chifbay", t: `Chifbay bietet private Bootstouren auf Madeira ab der Marina do Funchal, Steg C: ein Boot, immer nur eine Gruppe, bis zu 5 Gäste, mit zwei einheimischen Skippern. Tagestour mit Badestopp an der Fajã dos Padres ab ${DAY} €, Sonnenuntergangsfahrt ab ${SUNSET} €, Preis für das ganze Boot. Lizenzierter Anbieter für maritimen Tourismus (RNAAT 305/2026).`, a: "Unsere Geschichte", b: "Die Touren" },
  pt: { by: "Por", h: "Sobre a Chifbay", t: `A Chifbay faz passeios de barco privados na Madeira a partir da Marina do Funchal, cais C: um barco, um grupo de cada vez, até 5 pessoas, com dois skippers locais. Passeio de dia com banho na Fajã dos Padres desde ${DAY} €, pôr do sol desde ${SUNSET} €, preço para o barco inteiro. Operador marítimo-turístico licenciado (RNAAT 305/2026).`, a: "A nossa história", b: "Os passeios" },
  es: { by: "Por", h: "Sobre Chifbay", t: `Chifbay organiza excursiones privadas en barco en Madeira desde la Marina do Funchal, pantalán C: un barco, un grupo cada vez, hasta 5 personas, con dos patrones locales. Salida de día con baño en Fajã dos Padres desde ${DAY} €, atardecer desde ${SUNSET} €, precio por el barco entero. Operador de turismo marítimo con licencia (RNAAT 305/2026).`, a: "Nuestra historia", b: "Las salidas" },
  it: { by: "Di", h: "Chi è Chifbay", t: `Chifbay organizza gite private in barca a Madeira dalla Marina do Funchal, pontile C: una barca, un gruppo alla volta, fino a 5 persone, con due skipper locali. Uscita di giorno con bagno alla Fajã dos Padres da ${DAY} €, tramonto da ${SUNSET} €, prezzo per tutta la barca. Operatore di turismo marittimo autorizzato (RNAAT 305/2026).`, a: "La nostra storia", b: "Le uscite" },
};

// [find, replace] at the START of a hero line (after <p class="hsub">) or of an FAQ answer
// (visible <details> answer and JSON-LD acceptedAnswer text)
const TRIP = {
  "sunset-cruise": {
    en: { hero: ["A private sunset cruise from Funchal:", "Chifbay's private sunset cruise from Funchal, Madeira:"], faq: ["The sunset trip leaves", "Chifbay's sunset trip leaves"] },
    fr: { hero: ["Départ 1 h 15 avant", "La sortie privée au coucher du soleil de Chifbay, au départ de Funchal (Madère). Départ 1 h 15 avant"], faq: ["La sortie coucher de soleil quitte", "La sortie coucher de soleil de Chifbay quitte"] },
    de: { hero: ["Ablegen 1 Std. 15 Min.", "Die private Sonnenuntergangsfahrt von Chifbay ab Funchal, Madeira. Ablegen 1 Std. 15 Min."], faq: ["Die Sonnenuntergangstour legt", "Die Sonnenuntergangstour von Chifbay legt"] },
    pt: { hero: ["Largamos 1 h 15 antes", "O passeio privado ao pôr do sol da Chifbay, a partir do Funchal (Madeira). Largamos 1 h 15 antes"], faq: ["O passeio ao pôr do sol larga", "O passeio ao pôr do sol da Chifbay larga"] },
    es: { hero: ["Zarpamos 1 h 15 antes", "La salida privada al atardecer de Chifbay desde Funchal (Madeira). Zarpamos 1 h 15 antes"], faq: ["La salida al atardecer zarpa", "La salida al atardecer de Chifbay zarpa"] },
    it: { hero: ["Si salpa 1 h 15 prima", "L'uscita privata al tramonto di Chifbay da Funchal (Madeira). Si salpa 1 h 15 prima"], faq: ["L'uscita al tramonto salpa", "L'uscita al tramonto di Chifbay salpa"] },
  },
  "hidden-coves-half-day": {
    en: { hero: ["A private day boat trip from Funchal along the whole west coast:", "Chifbay's private day boat trip from Funchal, Madeira, along the whole west coast:"], faq: ["Two slots a day from Marina do Funchal", "Chifbay runs two slots a day from Marina do Funchal"] },
    fr: { hero: ["Toute la côte ouest d'une traite", "La sortie privée en bateau de Chifbay, au départ de Funchal (Madère). Toute la côte ouest d'une traite"], faq: ["Deux créneaux par jour au départ de la Marina do Funchal", "Chifbay propose deux créneaux par jour au départ de la Marina do Funchal"] },
    de: { hero: ["Die ganze Westküste in einer Fahrt", "Die private Bootstour von Chifbay ab Funchal, Madeira. Die ganze Westküste in einer Fahrt"], faq: ["Zwei Zeitfenster pro Tag ab der Marina do Funchal", "Chifbay fährt in zwei Zeitfenstern pro Tag ab der Marina do Funchal"] },
    pt: { hero: ["Toda a costa oeste de uma vez", "O passeio privado de barco da Chifbay, a partir do Funchal (Madeira). Toda a costa oeste de uma vez"], faq: ["Dois horários por dia a partir da Marina do Funchal", "A Chifbay tem dois horários por dia a partir da Marina do Funchal"] },
    es: { hero: ["Toda la costa oeste de una tirada", "La excursión privada en barco de Chifbay desde Funchal (Madeira). Toda la costa oeste de una tirada"], faq: ["Dos horarios al día desde la Marina do Funchal", "Chifbay ofrece dos horarios al día desde la Marina do Funchal"] },
    it: { hero: ["Tutta la costa ovest in un'unica uscita", "La gita privata in barca di Chifbay da Funchal (Madeira). Tutta la costa ovest in un'unica uscita"], faq: ["Due fasce orarie al giorno dalla Marina do Funchal", "Chifbay propone due fasce orarie al giorno dalla Marina do Funchal"] },
  },
};

const HOME = {
  en: [["From <strong>€400", "With Chifbay, from <strong>€400"], ["From €400 for the 2-hour sunset trip", "With Chifbay, from €400 for the 2-hour sunset trip"], ["From EUR 400 for the 2-hour sunset trip", "With Chifbay, from EUR 400 for the 2-hour sunset trip"],
       ["Local wine, poncha, beer, soft drinks and snacks", "On every Chifbay trip: local wine, poncha, beer, soft drinks and snacks"],
       ["Marina do Funchal, Pontoon C, next to the statue", "Chifbay trips leave from Marina do Funchal, Pontoon C, next to the statue"]],
  fr: [["De <strong>400 €", "Chez Chifbay, de <strong>400 €"], ["De 400 € pour la sortie", "Chez Chifbay, de 400 € pour la sortie"], ["Vin local, poncha, bière", "Sur chaque sortie Chifbay : vin local, poncha, bière"],
       ["Marina do Funchal, ponton C, à côté de la statue", "Les sorties Chifbay partent de la Marina do Funchal, ponton C, à côté de la statue"]],
  de: [["Von <strong>400 €", "Bei Chifbay von <strong>400 €"], ["Von 400 € für die 2-stündige", "Bei Chifbay von 400 € für die 2-stündige"], ["Lokaler Wein, Poncha, Bier", "Auf jeder Chifbay-Tour: lokaler Wein, Poncha, Bier"],
       ["Marina do Funchal, Ponton C, neben der Statue", "Die Chifbay-Touren starten an der Marina do Funchal, Ponton C, neben der Statue"]],
  pt: [["Desde <strong>400 €", "Com a Chifbay, desde <strong>400 €"], ["Desde 400 € pelo passeio", "Com a Chifbay, desde 400 € pelo passeio"], ["Vinho local, poncha, cerveja", "Em todos os passeios da Chifbay: vinho local, poncha, cerveja"],
       ["Marina do Funchal, cais C, junto à estátua", "Os passeios da Chifbay partem da Marina do Funchal, cais C, junto à estátua"]],
  es: [["Desde <strong>400 €", "Con Chifbay, desde <strong>400 €"], ["Desde 400 € por la salida", "Con Chifbay, desde 400 € por la salida"], ["Vino local, poncha, cerveza", "En cada salida de Chifbay: vino local, poncha, cerveza"],
       ["Marina do Funchal, pantalán C, junto a la estatua", "Las salidas de Chifbay parten de la Marina do Funchal, pantalán C, junto a la estatua"]],
  it: [["Da <strong>400 €", "Con Chifbay, da <strong>400 €"], ["Da 400 € per l'uscita", "Con Chifbay, da 400 € per l'uscita"], ["Vino locale, poncha, birra", "In ogni uscita Chifbay: vino locale, poncha, birra"],
       ["Marina do Funchal, pontile C, accanto alla statua", "Le uscite Chifbay partono dalla Marina do Funchal, pontile C, accanto alla statua"]],
};

const ABOUT = {
  en: { badge: "Chifbay · Funchal, Madeira", n: "Guests at most, one group at a time", r: "Rated on Google, GetYourGuide &amp; Tripadvisor" },
  fr: { badge: "Chifbay · Funchal, Madère", n: "Personnes au maximum, un seul groupe à la fois", r: "Noté sur Google, GetYourGuide &amp; Tripadvisor" },
  de: { badge: "Chifbay · Funchal, Madeira", n: "Gäste höchstens, immer nur eine Gruppe", r: "Bewertet auf Google, GetYourGuide &amp; Tripadvisor" },
  pt: { badge: "Chifbay · Funchal, Madeira", n: "Pessoas no máximo, um grupo de cada vez", r: "Avaliação no Google, GetYourGuide e Tripadvisor" },
  es: { badge: "Chifbay · Funchal, Madeira", n: "Personas como máximo, un grupo cada vez", r: "Valorado en Google, GetYourGuide y Tripadvisor" },
  it: { badge: "Chifbay · Funchal, Madeira", n: "Persone al massimo, un gruppo alla volta", r: "Valutazione su Google, GetYourGuide &amp; Tripadvisor" },
};

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const langOf = (h) => (h.match(/<html[^>]*lang="([a-z]{2})/) || [])[1] || "en";
const link = (l, page) => (existsSync(join(SITE, `${pre(l)}${page}.html`)) ? `/${pre(l)}${page}` : `/${pre(l)}`);

// JSON-LD sometimes stores the answers without accents ("Faja", "creneaux"): try both spellings there
function ldReplace(h, find, repl) {
  let n = 0;
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, (block) => {
    if (!block.includes("FAQPage")) return block;
    for (const [f, r] of [[find, repl], [fold(find), fold(repl)]]) {
      const re = new RegExp(`("acceptedAnswer":\\{"@type":"Answer","text":")${esc(f)}`, "g");
      block = block.replace(re, (m, a) => { n++; return a + r; });
    }
    return block;
  });
  return [h, n];
}
// a visible FAQ answer: the first <p> after a <summary>
function faqReplace(h, find, repl) {
  let n = 0;
  h = h.replace(new RegExp(`(</summary>\\s*<p[^>]*>)${esc(find)}`, "g"), (m, a) => { n++; return a + repl; });
  return [h, n];
}

const report = [];
let files = 0;
function save(rel, before, after, what) {
  if (before === after) return;
  files++;
  report.push(`${rel}: ${what.join(", ")}`);
  if (WRITE) writeFileSync(join(SITE, rel), after);
}

// 1. Guides articles
let articles = 0, noMeta = [];
for (const l of LANGS) {
  const dir = `${pre(l)}posts`;
  if (!existsSync(join(SITE, dir))) continue;
  for (const f of readdirSync(join(SITE, dir))) {
    if (!f.endsWith(".html")) continue;
    const rel = `${dir}/${f}`, before = readFileSync(join(SITE, rel), "utf8");
    if (!before.includes("</article>")) continue;
    const lang = langOf(before), B = BOX[lang] || BOX.en, what = [];
    let h = before;
    // byline: first item of the article meta line, in the page's language
    const by = `<span data-by>${B.by} <a href="/${pre(lang)}about" style="color:inherit">Chifbay</a></span>`;
    if (h.includes("<span data-by>")) {
      h = h.replace(/<span data-by>[\s\S]*?Chifbay<\/a><\/span>/, by);
    } else if (/<div class="artmeta[^"]*"[^>]*>/.test(h)) {
      h = h.replace(/(<div class="artmeta[^"]*"[^>]*>)/, `$1${by}`);
    } else noMeta.push(rel);
    if (h !== before) what.push("byline");
    // the box, right after the article
    const box = `<aside class="about-cb" data-about-cb><b>${B.h}</b>${B.t} <a href="/${pre(lang)}about">${B.a}</a> · <a href="${link(lang, "experiences")}">${B.b}</a></aside>`;
    const h2 = /<aside class="about-cb" data-about-cb>[\s\S]*?<\/aside>/.test(h)
      ? h.replace(/<aside class="about-cb" data-about-cb>[\s\S]*?<\/aside>/, box)
      : h.replace("</article>", `</article>\n    ${box}`);
    if (h2 !== h) what.push("about box");
    h = h2;
    // JSON-LD author: the same business the home page describes
    const h3 = h.replace(/"author":\{"@type":"Organization","name":"Chifbay"\}/g, `"author":{"@type":"Organization","name":"Chifbay","url":"https://chifbay.com/","@id":"${BIZ}"}`);
    if (h3 !== h) what.push("JSON-LD author");
    h = h3;
    if (what.length) articles++;
    save(rel, before, h, what);
  }
}

// 2. Trip pages
const misses = [];
for (const [page, byLang] of Object.entries(TRIP)) {
  for (const l of LANGS) {
    const rel = `${pre(l)}${page}.html`;
    if (!existsSync(join(SITE, rel)) || !byLang[l]) continue;
    const before = readFileSync(join(SITE, rel), "utf8"), what = [];
    let h = before;
    const [hf, hr] = byLang[l].hero;
    if (!h.includes(`<p class="hsub">${hr}`)) {
      const n0 = h.length; h = h.replace(`<p class="hsub">${hf}`, `<p class="hsub">${hr}`);
      if (h.length !== n0) what.push("hero"); else misses.push(`${rel} hero`);
    }
    const [ff, fr] = byLang[l].faq;
    let a, b;
    [h, a] = faqReplace(h, ff, fr);
    [h, b] = ldReplace(h, ff, fr);
    if (a) what.push("FAQ"); if (b) what.push("FAQ JSON-LD");
    if (!a && !h.includes(fr)) misses.push(`${rel} FAQ`);
    if (!b && !fold(h).includes(fold(fr))) misses.push(`${rel} FAQ JSON-LD`);
    save(rel, before, h, what);
  }
}

// 3. Home FAQ
for (const l of LANGS) {
  const rel = `${pre(l)}index.html`, before = readFileSync(join(SITE, rel), "utf8"), what = [];
  let h = before;
  for (const [f, r] of HOME[l]) {
    let a, b;
    [h, a] = faqReplace(h, f, r);
    [h, b] = ldReplace(h, f, r);
    if (a || b) what.push(`"${r.slice(0, 28)}..." (${a} visible, ${b} JSON-LD)`);
  }
  save(rel, before, h, what);
}

// 4. About pages
for (const l of LANGS) {
  const rel = `${pre(l)}about.html`;
  if (!existsSync(join(SITE, rel))) continue;
  const before = readFileSync(join(SITE, rel), "utf8"), A = ABOUT[l], what = [];
  let h = before;
  h = h.replace(/(<div class="hbadge[^"]*">)Chifbay · [^<]*2019(<\/div>)/, (m, a, b) => { what.push("badge"); return `${a}${A.badge}${b}`; });
  h = h.replace(/<span class="sn">2019<\/span><span class="sl">[^<]*<\/span>/, () => { what.push("2019 stat"); return `<span class="sn">5</span><span class="sl">${A.n}</span>`; });
  h = h.replace(/<span class="sl">[^<]*Airbnb[^<]*<\/span>/, () => { what.push("ratings"); return `<span class="sl">${A.r}</span>`; });
  save(rel, before, h, what);
}

console.log(report.join("\n"));
console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${files} file(s), ${articles} article(s)` +
  (noMeta.length ? `\nno article meta line (byline skipped): ${noMeta.join(", ")}` : "") +
  (misses.length ? `\nNOT FOUND: ${misses.join(", ")}` : ""));
// a miss only warns: this also runs inside the article workflows, which must never fail because a trip page was reworded
