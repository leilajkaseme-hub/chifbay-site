#!/usr/bin/env node
/**
 * add-livro-reclamacoes.mjs — put the official complaints-book link in the footer.
 *
 * WHY
 * ---
 * Portuguese law (Decreto-Lei 156/2005, as amended by DL 74/2017) requires any
 * business supplying goods or services to consumers — tourist-entertainment
 * operators included — to give consumers access to the electronic complaints
 * book, and a business with a website must publish the link on that website.
 *
 * chifbay.com had no such link, in any of its six languages. The footer says
 * "Licensed maritime tourism operator", which is the claim the law attaches
 * this duty to, so the gap is real, not cosmetic.
 *
 * The link is the same for every business: the state portal at
 * livroreclamacoes.pt. There is nothing per-company to fill in and nothing to
 * register, which is why this can ship immediately, unlike the licence number
 * (which is still unverified and must never be guessed).
 *
 * WHERE IT GOES
 * -------------
 * Last item of the footer's Contact column, straight after the privacy link,
 * in every page and every language. The label stays in Portuguese in all
 * languages — it is the legal name of the instrument, the way "IBAN" is not
 * translated — with a localized title attribute so a non-Portuguese visitor
 * still understands what it is.
 *
 * RUN
 * ---
 *   node scripts/add-livro-reclamacoes.mjs --check   report only, writes nothing
 *   node scripts/add-livro-reclamacoes.mjs
 *
 * Re-running is safe: a page that already carries the marker is skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_OFICIAL = "https://www.livroreclamacoes.pt/inicio";
const MARKER = "livro-reclamacoes";
const CHECK = process.argv.includes("--check");

/** Language folders that exist as a built site section, plus the English root. */
const LANG_DIRS = ["fr", "de", "pt", "es", "it"];

/** The visible label is deliberately identical everywhere. Only the tooltip,
 *  which is what a French or German visitor reads on hover, changes. */
const TITLE = {
  en: "Complaints book — the official Portuguese consumer portal",
  fr: "Livre de réclamations — le portail officiel des consommateurs au Portugal",
  de: "Beschwerdebuch — das offizielle portugiesische Verbraucherportal",
  pt: "Livro de Reclamações — portal oficial do consumidor",
  es: "Libro de reclamaciones — el portal oficial del consumidor en Portugal",
  it: "Libro dei reclami — il portale ufficiale dei consumatori in Portogallo",
};

const linkFor = (lang) =>
  `<a class="${MARKER}" href="${URL_OFICIAL}" target="_blank" rel="noopener"` +
  ` title="${TITLE[lang] || TITLE.en}">Livro de Reclamações</a>`;

/** Which language a file belongs to, decided by its folder, not its content. */
function langOf(file) {
  const rel = path.relative(ROOT, file);
  const first = rel.split(path.sep)[0];
  return LANG_DIRS.includes(first) ? first : "en";
}

/** Every .html under the site, skipping build spoil and dependencies. */
function htmlFiles(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/** Anchor on the privacy link, but ONLY the one inside <footer>.
 *
 *  A first attempt matched the first privacy link in the whole document and
 *  put the new link in the wrong place on two page kinds: the language
 *  switcher, which links /fr/privacy.html … /it/privacy.html, and the body of
 *  privacy.html itself, which links to its own policy mid-sentence. Scoping to
 *  the footer block first removes both, because the footer carries exactly one
 *  privacy link on every page and in every language. */
const FOOTER = /<footer[\s\S]*?<\/footer>/;
const PRIVACY = /(<a href="[^"]*privacy\.html">[^<]*<\/a>)/;

let added = 0, already = 0, noFooter = 0;
const skipped = [];

for (const file of htmlFiles()) {
  const html = fs.readFileSync(file, "utf8");

  if (html.includes(MARKER)) { already++; continue; }

  const footer = html.match(FOOTER);
  if (!footer || !PRIVACY.test(footer[0])) {
    noFooter++;
    skipped.push(path.relative(ROOT, file));
    continue;
  }

  const patched = footer[0].replace(PRIVACY, `$1\n        ${linkFor(langOf(file))}`);
  const next = html.replace(FOOTER, () => patched);
  if (!CHECK) fs.writeFileSync(file, next);
  added++;
}

console.log(`${CHECK ? "would add" : "added"}: ${added}`);
console.log(`already had it: ${already}`);
console.log(`no privacy link to anchor on: ${noFooter}`);
if (skipped.length) {
  console.log("\nnot touched (check these by hand):");
  for (const f of skipped.slice(0, 25)) console.log(`  ${f}`);
  if (skipped.length > 25) console.log(`  … and ${skipped.length - 25} more`);
}
