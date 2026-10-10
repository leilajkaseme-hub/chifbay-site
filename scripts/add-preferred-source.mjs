#!/usr/bin/env node
// add-preferred-source.mjs: the Google "preferred source" link under every Journal article.
//
//   node scripts/add-preferred-source.mjs           dry run
//   node scripts/add-preferred-source.mjs --write   applies it
//
// A reader who clicks it can pick chifbay.com as a preferred source in Google, so our
// articles show up more for them in Top Stories, AI Overviews and AI Mode.
// Google's deeplink, not its JavaScript button: no Google script on the page, nothing
// stored on the visitor's device, so the site still needs no cookie banner.
// Docs: developers.google.com/search/docs/appearance/preferred-sources
// Goes right after </article> in posts/ and <lang>/posts/. Safe to run again.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const URL = "https://www.google.com/preferences/source?q=chifbay.com";
const MARK = "data-pref-source";
const T = {
  en: ["Enjoying our Madeira guides?", "Add Chifbay as a preferred source on Google"],
  fr: ["Nos guides de Madère vous plaisent ?", "Ajoutez Chifbay à vos sources préférées sur Google"],
  de: ["Gefallen Ihnen unsere Madeira-Guides?", "Chifbay als bevorzugte Quelle bei Google hinzufügen"],
  pt: ["Gosta dos nossos guias da Madeira?", "Adicione a Chifbay às suas fontes preferidas no Google"],
  es: ["¿Te gustan nuestras guías de Madeira?", "Añade Chifbay como fuente preferida en Google"],
  it: ["Ti piacciono le nostre guide di Madeira?", "Aggiungi Chifbay alle fonti preferite su Google"],
};
const G = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>`;

function block(lang) {
  const [q, cta] = T[lang] || T.en;
  return `<p class="pref-src" ${MARK}><span>${q}</span> <a href="${URL}" target="_blank" rel="noopener">${G}${cta}</a></p>`;
}

const dirs = ["posts", ...Object.keys(T).filter((l) => l !== "en").map((l) => `${l}/posts`)];
let changed = 0, noAnchor = [];
for (const dir of dirs) {
  if (!existsSync(join(SITE, dir))) continue;
  for (const f of readdirSync(join(SITE, dir))) {
    if (!f.endsWith(".html")) continue;
    const abs = join(SITE, dir, f);
    const h = readFileSync(abs, "utf8");
    if (h.includes(MARK)) continue;
    if (!h.includes("</article>")) { noAnchor.push(`${dir}/${f}`); continue; }
    const lang = (h.match(/<html[^>]*lang="([a-z]{2})/) || [])[1] || "en";
    const out = h.replace("</article>", `</article>\n    ${block(lang)}`);
    changed++;
    if (WRITE) writeFileSync(abs, out);
  }
}
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${changed} article(s)` + (noAnchor.length ? `, ${noAnchor.length} without </article>: ${noAnchor.join(", ")}` : ""));
