#!/usr/bin/env node
/**
 * add-rnaat-number.mjs — publish the tourism licence number in the footer.
 *
 * WHY
 * ---
 * Decreto-Lei 108/2009 art. 8.º(2) obliges a registered tourist-entertainment
 * operator to state its registration number and the address of its seat in
 * "contratos, correspondência, publicações, anúncios e em toda a atividade
 * externa" — Turismo de Portugal's own FAQ adds "mesmo que efetuada online".
 *
 * Every footer already claimed "Licensed maritime tourism operator" in six
 * languages without ever saying which licence. That is the claim the duty
 * attaches to, so the site was asserting the status while withholding the proof.
 *
 * THE NUMBER IS VERIFIED, NOT ASSUMED
 * -----------------------------------
 * Read on the state register itself:
 *   https://rnt.turismodeportugal.pt/RNT/RNAAT.aspx?nr=305%2f2026
 *
 *   RNAAT n.º 305/2026 · registered 2026-03-30
 *   Tipo:        OPERADOR MARÍTIMO TURÍSTICO
 *   Denominação: CHIF&CO, LDA
 *   NIPC:        518603750
 *   Sede:        Rampa dos Piornais, lote 14 porta 10, 5A, 9000-682 Funchal
 *
 * Three independent facts tie that entry to this website, so it is not a
 * name match:
 *   1. civil-liability policy BR66385591 on the register is the same policy
 *      number already published on chifbay.com/terms.html
 *   2. the register's phone 937200320 is the site footer's +351 937 200 320
 *   3. the register's contact chifmadeira@gmail.com is one of the two mailboxes
 *      the booking calendar sync already reads
 *
 * A licence number is not something to infer. If any of those three had failed
 * to match, the right output would have been no number at all.
 *
 * RUN
 * ---
 *   node scripts/add-rnaat-number.mjs --check
 *   node scripts/add-rnaat-number.mjs
 *
 * Safe to re-run: a footer already carrying the number is left alone.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const RNAAT = "RNAAT n.º 305/2026";
const ENTITY = "CHIF&amp;CO, Lda";
const NIPC = "NIPC 518603750";

/** The existing footer sentence, per language. The licence detail is appended
 *  to it rather than replacing it: the sentence is the human claim, the number
 *  is the proof, and the law wants both visible. */
const FOOTER_CLAIM = {
  en: "Licensed maritime tourism operator",
  fr: "Opérateur de tourisme maritime agréé",
  de: "Lizenzierter Anbieter für maritimen Tourismus",
  pt: "Operador de turismo marítimo licenciado",
  es: "Operador turístico marítimo con licencia",
  it: "Operatore turistico marittimo autorizzato",
};

const LANG_DIRS = ["fr", "de", "pt", "es", "it"];

function langOf(file) {
  const first = path.relative(ROOT, file).split(path.sep)[0];
  return LANG_DIRS.includes(first) ? first : "en";
}

function htmlFiles(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

let added = 0, already = 0, noClaim = 0;

for (const file of htmlFiles()) {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes(RNAAT)) { already++; continue; }

  const claim = FOOTER_CLAIM[langOf(file)];
  if (!html.includes(claim)) { noClaim++; continue; }

  // Only the footer line is touched — the claim string is unique to it.
  const next = html.replace(claim, `${claim} · ${RNAAT} · ${ENTITY} · ${NIPC}`);
  if (!CHECK) fs.writeFileSync(file, next);
  added++;
}

console.log(`${CHECK ? "would add" : "added"}: ${added}`);
console.log(`already had it: ${already}`);
console.log(`no footer claim to append to: ${noClaim}`);
