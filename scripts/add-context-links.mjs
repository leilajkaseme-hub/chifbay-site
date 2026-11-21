#!/usr/bin/env node
// add-context-links.mjs: hand-written sentences that link a page to the page that sells (21 Nov 2026).
//
//   node scripts/add-context-links.mjs           dry run
//   node scripts/add-context-links.mjs --write   apply   (safe to run again)
//
// add-money-links.mjs only turns words already in an article into links. Two pages had almost no
// such words to work with: /boat-rental-with-skipper-funchal (2 links from page bodies) and /reviews
// (none from the Journal). The Journal posts that bring the most clicks (Search Console, Aug to Nov
// 2026) had no link to the trip they describe near the top, and the two new local pages
// (de/bootstour-funchal, pt/passeio-de-barco-funchal) had no link from their language's home page.
// Each entry adds one sentence after an exact passage; its link carries data-cl, so a second run
// sees it and adds nothing, and add-money-links.mjs (which removes only data-ml links) leaves it.
// A passage that is no longer there is reported, never guessed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const L = (href, text) => `<a href="${href}" data-cl>${text}</a>`;
const RENTAL = "/boat-rental-with-skipper-funchal";

// [file, passage the sentence follows (ends a paragraph), sentence or paragraph to add]
const ADD = [
  // boat rental with skipper
  ["posts/do-you-tip-the-skipper-on-a-boat-trip-in-madeira.html", "A thank-you and a note in the hand is enough.",
    ` If you were hoping to drive a boat yourself, our page on ${L(RENTAL, "boat rental with skipper in Funchal")} explains why every trip comes with two licensed local skippers instead.`],
  ["posts/private-boat-charter-vs-shared-tour-madeira.html", "who else is on the boat, and who decides the plan, are completely different.",
    ` In Funchal, a private charter works like a ${L(RENTAL, "boat rental with a skipper")}: you hire the whole boat and a licensed local crew drives it.`],
  ["posts/boat-trip-prices-madeira-private-charter-cost-guide.html", "the 2h Sunset Trip works out at €80 each and the 2h30 Day Trip at €100 each.",
    ` Nobody in your group needs a licence either: it is a ${L(RENTAL, "boat rental with skipper")}, and two local skippers drive.`],
  ["posts/private-boat-in-madeira-for-two-people.html", "It is the two of you and the skipper.",
    ` Think of it as a ${L(RENTAL, "private boat hire with skipper")}: you never have to steer, moor or plan the route.`],
  ["posts/how-far-in-advance-to-book-a-boat-trip-in-madeira.html", "So each departure is sold once, to one group, and then it is gone.",
    ` That is how a ${L(RENTAL, "boat rental with skipper in Funchal")} works: one group, one boat, two local skippers at the wheel.`],
  // reviews
  ["posts/how-far-in-advance-to-book-a-boat-trip-in-madeira.html", "Ask, and we will tell you if it can work.",
    ` Before you choose, you can read what earlier guests wrote on GetYourGuide, Tripadvisor and Google, gathered on our ${L("/reviews", "reviews page")}.`],
  ["posts/is-a-private-boat-trip-in-madeira-worth-it.html", "For these groups, we think the private boat wins easily.",
    ` For a second opinion, read ${L("/reviews", "reviews from past guests")}.`],
  ["posts/birthday-boat-trip-madeira-private-celebration-guide.html", "ask us beforehand so we can tell you what works on board.",
    ` Several ${L("/reviews", "guest reviews")} come from birthday groups, if you want to see how others did it.`],
  ["posts/private-boat-charter-vs-shared-tour-madeira.html", "your route, your timing, your boat.",
    ` Our ${L("/reviews", "guest reviews")} show what that looks like in practice.`],
  ["posts/private-boat-in-madeira-for-two-people.html", "so two people pay the same 400 to 600 EUR as a group of five and nobody else comes on board.",
    ` Couples write about it in our ${L("/reviews", "guest reviews")}.`],
  // the posts that rank: the matching trip, in the first paragraph
  ["posts/cliff-jumping-in-madeira-guide.html", `how it works on a <a href="/private-boat-tour-madeira" data-ml>private boat</a>.`,
    ` On our ${L("/hidden-coves-half-day", "day trip with swimming")}, you jump in off the boat at Fajã dos Padres.`],
  ["posts/snorkeling-in-madeira-guide.html", "Here's where to go, what you'll see, and when.",
    ` Our ${L("/hidden-coves-half-day", "private day boat trip")} stops to swim at Fajã dos Padres and Ribeira Brava.`],
  ["posts/top-10-sunset-spots-in-madeira.html", "ranked by what they're worth.",
    ` To watch it from the water instead, see our ${L("/sunset-cruise", "private sunset cruise from Funchal")}.`],
  ["posts/madeira-sea-temperature-swimming-guide.html", "and how we plan swim stops on the boat.",
    ` The swim stops are on our ${L("/hidden-coves-half-day", "day boat trip from Funchal")}.`],
  ["de/posts/top-10-villages-in-madeira.html", "über Porto Moniz und Ponta do Sol bis zum Nonnental.",
    ` Câmara de Lobos, Ribeira Brava und Ponta do Sol sehen Sie auf unserer ${L("/de/bootstour-funchal", "Bootstour ab Funchal")} auch vom Wasser aus.`],
  ["de/posts/top-10-marine-animals-madeira.html", "damit Sie mit realistischen Erwartungen planen können.",
    ` Wer die Südküste selbst vom Wasser aus erleben will: Unsere ${L("/de/hidden-coves-half-day", "Tagestour mit Baden")} startet in Funchal, Delfine sind dabei ein Geschenk, nie ein Versprechen.`],
  ["pt/posts/top-10-sunset-spots-in-madeira.html", "com o que cada um tem de bom e de menos bom.",
    ` Para o ver a partir do mar, há o nosso ${L("/pt/sunset-cruise", "passeio de barco ao pôr do sol no Funchal")}.`],
  // the two local pages, from their language
  ["de/index.html", "Ihr Skipper empfängt Sie am Steg — kein Büro, keine Schlange, kein Shuttle.</p>",
    `\n        <p>Start, Zeiten und die zwei Touren auf einen Blick: ${L("/de/bootstour-funchal", "Bootstour ab Funchal")}.</p>`],
  ["pt/index.html", "O skipper recebe-o no pontão — sem escritório, sem filas, sem transfers.</p>",
    `\n        <p>A partida, os horários e os dois passeios numa só página: ${L("/pt/passeio-de-barco-funchal", "passeio de barco no Funchal")}.</p>`],
  ["de/experiences.html", "wir gestalten die perfekte private Route ab der Marina do Funchal.",
    ` Treffpunkt und Zeiten: ${L("/de/bootstour-funchal", "Bootstour ab Funchal")}.`],
  ["pt/experiences.html", "desenhamos o percurso privado perfeito a partir da Marina do Funchal.",
    ` Ponto de encontro e horários: ${L("/pt/passeio-de-barco-funchal", "passeio de barco no Funchal")}.`],
];

const changed = new Map(), missing = [];
for (const [rel, after, add] of ADD) {
  if (/[–—]/.test(add)) throw new Error(`${rel}: en or em dash in new text`);
  const html = changed.get(rel) ?? fs.readFileSync(path.join(ROOT, rel), "utf8");
  const href = add.match(/<a href="([^"]+)" data-cl>/)[1];
  if (html.includes(`<a href="${href}" data-cl>`)) continue;
  const n = html.split(after).length - 1;
  if (n !== 1) { missing.push(`${rel}: passage found ${n} times: "${after.slice(0, 60)}"`); continue; }
  changed.set(rel, html.replace(after, after + add));
}
for (const [rel, html] of changed) {
  console.log(`${WRITE ? "write" : "would write"}: ${rel}`);
  if (WRITE) fs.writeFileSync(path.join(ROOT, rel), html);
}
if (missing.length) console.log(`NOT ADDED (passage changed):\n  ${missing.join("\n  ")}`);
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed.size} file(s).`);
