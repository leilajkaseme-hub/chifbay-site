/**
 * Rewrite the "Cookies" paragraph on every privacy page so it matches what the
 * site actually does now: Google Analytics 4 and the Meta pixel, both behind a
 * consent banner, both shared with the Wix booking subdomain.
 *
 *   node scripts/update-privacy-cookies.mjs           dry run
 *   node scripts/update-privacy-cookies.mjs --write   apply
 *
 * Run again after adding a new language. It replaces the whole paragraph that
 * follows the Cookies heading, so running it twice changes nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");

// [file, heading to find, new paragraph, "change my choice" label]
const COPY = {
  "privacy.html": {
    head: "Cookies &amp; analytics",
    body: "We use Google Analytics 4 and the Meta (Facebook and Instagram) pixel to measure our advertising, plus a cookie that remembers your language and your cookie choice. Nothing loads until you accept: on your first visit these tools are switched off and no advertising or analytics cookie is written. Because our booking site (book.chifbay.com) sits on the same domain, your choice and your visit carry across it, so you are only asked once. Google and Meta act as our processors and may transfer data outside the EU under the EU–US Data Privacy Framework.",
    link: "Change my cookie choice"
  },
  "fr/privacy.html": {
    head: "Cookies et analyses",
    body: "Nous utilisons Google Analytics 4 et le pixel Meta (Facebook et Instagram) pour mesurer nos publicités, ainsi qu'un cookie qui mémorise votre langue et votre choix en matière de cookies. Rien ne se charge avant votre accord : lors de votre première visite, ces outils sont désactivés et aucun cookie publicitaire ou de mesure n'est déposé. Comme notre site de réservation (book.chifbay.com) se trouve sur le même domaine, votre choix et votre visite s'y appliquent aussi, et la question ne vous est posée qu'une fois. Google et Meta agissent comme sous-traitants et peuvent transférer des données hors de l'UE dans le cadre du Data Privacy Framework UE–États-Unis.",
    link: "Modifier mon choix de cookies"
  },
  "de/privacy.html": {
    head: "Cookies und Analyse",
    body: "Wir verwenden Google Analytics 4 und das Meta-Pixel (Facebook und Instagram), um unsere Werbung zu messen, sowie ein Cookie, das Ihre Sprache und Ihre Cookie-Entscheidung speichert. Vor Ihrer Zustimmung wird nichts geladen: Beim ersten Besuch sind diese Dienste ausgeschaltet und es wird kein Werbe- oder Analyse-Cookie gesetzt. Da unsere Buchungsseite (book.chifbay.com) auf derselben Domain liegt, gelten Ihre Entscheidung und Ihr Besuch auch dort, und Sie werden nur einmal gefragt. Google und Meta handeln als Auftragsverarbeiter und können Daten im Rahmen des EU-US Data Privacy Framework außerhalb der EU übermitteln.",
    link: "Cookie-Entscheidung ändern"
  },
  "pt/privacy.html": {
    head: "Cookies e análise",
    body: "Utilizamos o Google Analytics 4 e o pixel da Meta (Facebook e Instagram) para medir a nossa publicidade, além de um cookie que memoriza o seu idioma e a sua escolha sobre cookies. Nada é carregado antes do seu consentimento: na primeira visita estas ferramentas estão desligadas e nenhum cookie de publicidade ou de análise é criado. Como o nosso site de reservas (book.chifbay.com) está no mesmo domínio, a sua escolha e a sua visita acompanham-no, pelo que só lhe perguntamos uma vez. A Google e a Meta atuam como subcontratantes e podem transferir dados para fora da UE ao abrigo do Data Privacy Framework UE–EUA.",
    link: "Alterar a minha escolha de cookies"
  },
  "es/privacy.html": {
    head: "Cookies y analítica",
    body: "Utilizamos Google Analytics 4 y el píxel de Meta (Facebook e Instagram) para medir nuestra publicidad, además de una cookie que recuerda tu idioma y tu elección sobre cookies. No se carga nada antes de tu consentimiento: en tu primera visita estas herramientas están desactivadas y no se crea ninguna cookie publicitaria ni de analítica. Como nuestro sitio de reservas (book.chifbay.com) está en el mismo dominio, tu elección y tu visita se mantienen allí, por lo que solo te lo preguntamos una vez. Google y Meta actúan como encargados del tratamiento y pueden transferir datos fuera de la UE al amparo del Data Privacy Framework UE–EE. UU.",
    link: "Cambiar mi elección de cookies"
  },
  "it/privacy.html": {
    head: "Cookie e analisi",
    body: "Utilizziamo Google Analytics 4 e il pixel di Meta (Facebook e Instagram) per misurare la nostra pubblicità, oltre a un cookie che ricorda la tua lingua e la tua scelta sui cookie. Nulla viene caricato prima del tuo consenso: alla prima visita questi strumenti sono disattivati e non viene creato alcun cookie pubblicitario o di analisi. Poiché il nostro sito di prenotazione (book.chifbay.com) si trova sullo stesso dominio, la tua scelta e la tua visita ti seguono anche lì, quindi te lo chiediamo una volta sola. Google e Meta agiscono come responsabili del trattamento e possono trasferire dati fuori dall'UE nell'ambito del Data Privacy Framework UE-USA.",
    link: "Modifica la mia scelta sui cookie"
  }
};

// A button, not an <a>: it reopens the banner instead of going anywhere.
const button = (label) =>
  `<p><button type="button" class="cb-consent-reopen" ` +
  `onclick="window.cbConsent&&window.cbConsent.reopen()" ` +
  `style="cursor:pointer;background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline">` +
  `${label}</button></p>`;

let changed = 0;
for (const [rel, copy] of Object.entries(COPY)) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.warn("  ! missing: " + rel); continue; }

  const html = fs.readFileSync(file, "utf8");
  const heading = `<h2>${copy.head}</h2>`;
  if (!html.includes(heading)) { console.warn(`  ! heading not found in ${rel}: ${copy.head}`); continue; }

  // The heading, then its paragraph, then anything we added last time.
  const block = new RegExp(
    escape(heading) + "\\s*<p>[\\s\\S]*?</p>" + "(\\s*<p><button[\\s\\S]*?</p>)?",
    "i"
  );
  const next = html.replace(block, `${heading}\n      <p>${copy.body}</p>\n      ${button(copy.link)}`);

  if (next === html) { console.log("  = " + rel + " (already current)"); continue; }
  if (write) fs.writeFileSync(file, next);
  changed++;
  console.log("  + " + rel);
}

function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

console.log(`\n${changed} privacy page(s) updated${write ? "" : " (dry run, pass --write to apply)"}`);
