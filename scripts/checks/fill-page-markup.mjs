#!/usr/bin/env node
// fill-page-markup.mjs — pose le balisage manquant sur les pages traduites.
//
// Constat mesure le 21 septembre 2026 dans l onglet Statistics de Semrush:
// 21 % des pages n avaient AUCUNE donnee structuree. En regardant page par
// page, ce n est pas aleatoire: les pages anglaises `about`, `blog`,
// `experiences` portent leur schema, leurs traductions non. Le traducteur
// recopie le corps de la page et laisse le bloc JSON-LD derriere lui.
//
// Ce script prend le bloc de la page anglaise et le reecrit pour la langue:
// l adresse, la langue, le nom et la description viennent de la page traduite
// elle meme, jamais d une invention. Il ne touche pas a une page qui a deja
// son bloc.
//
// Lancer: node scripts/checks/fill-page-markup.mjs [--dry]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LANGS = ["fr", "de", "pt", "es", "it"];
const PAGES = ["about.html", "blog.html", "experiences.html", "privacy.html"];
const DRY = process.argv.includes("--dry");

const read = (p) => readFileSync(join(SITE, p), "utf-8");
const meta = (h, name) =>
  (h.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, "i")) || [, ""])[1];
const prop = (h, p) =>
  (h.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`, "i")) || [, ""])[1];
const title = (h) => (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].trim();
const canonical = (h) => (h.match(/rel="canonical" href="([^"]+)"/) || [, ""])[1];

// Ce qu on NE porte PAS dans une autre langue, et c est le point important:
// un bloc dont le contenu est de la prose. Une FAQ anglaise recopiee sur une
// page francaise annonce a Google des questions que la page ne pose pas. Mieux
// vaut aucun bloc qu un bloc qui ment.
const PROSE = new Set(["FAQPage", "ItemList"]);

// Le fil d Ariane, traduit. Sans ca, une page francaise annonce "Home".
const CRUMB = {
  fr: { Home: "Accueil" }, de: { Home: "Startseite" }, pt: { Home: "Início" },
  es: { Home: "Inicio" }, it: { Home: "Home" },
};

// Le bloc anglais sert de patron. On remplace les seules valeurs qui
// dependent de la langue, et on laisse la structure intacte: c est elle qui
// dit a Google ce qu est la page. Le nom d une ENTITE (l entreprise, le site)
// n est pas un titre de page et ne change jamais: Chifbay s appelle Chifbay
// en allemand aussi.
const ENTITY = new Set(["Organization", "LocalBusiness", "WebSite", "TouristAttraction"]);

function localise(block, { url, lang, name, description }) {
  let d;
  try { d = JSON.parse(block); } catch { return null; }
  const type = [].concat(d["@type"] || []).join("+");
  if ([].concat(d["@type"] || []).some((t) => PROSE.has(t))) return null;

  const walk = (o) => {
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        if ((k === "url" || k === "item") && typeof o[k] === "string" && o[k].startsWith("https://chifbay.com")) {
          o[k] = o[k].replace("https://chifbay.com/", `https://chifbay.com/${lang}/`).replace(/\/{2,}$/, "/");
        } else o[k] = walk(o[k]);
      }
    }
    return o;
  };
  d = walk(d);
  // `inLanguage` n existe que sur une oeuvre. Sur un fil d Ariane ou sur une
  // entreprise, schema.org ne le connait pas et l audit compte une donnee
  // invalide. Mesure le 21 septembre 2026, apres l avoir pose partout.
  const OEUVRE = new Set(["WebPage", "WebSite", "Blog", "BlogPosting", "Article",
                          "FAQPage", "CreativeWork", "CollectionPage", "AboutPage"]);
  if ([].concat(d["@type"] || []).some((t) => OEUVRE.has(t))) d.inLanguage = lang;

  if (Array.isArray(d.itemListElement)) {
    const map = CRUMB[lang] || {};
    d.itemListElement = d.itemListElement.map((it, i) => {
      if (it && typeof it.name === "string") {
        it.name = map[it.name] || (i === d.itemListElement.length - 1 && name ? name : it.name);
      }
      return it;
    });
  }
  if (!ENTITY.has(type) && !Array.isArray(d.itemListElement)) {
    if (name) d.name = name;
    if (description && d.description !== undefined) d.description = description;
  }
  return JSON.stringify(d);
}

let touched = 0, added = 0;
for (const page of PAGES) {
  if (!existsSync(join(SITE, page))) continue;
  const en = read(page);
  const blocks = [...en.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());

  for (const lang of LANGS) {
    const rel = `${lang}/${page}`;
    if (!existsSync(join(SITE, rel))) continue;
    let h = read(rel);
    const url = canonical(h) || `https://chifbay.com/${rel}`;
    // Le nom court, pas le titre entier: un fil d Ariane qui dit
    // "Die Geschichte | Chifbay · Private Bootstouren, Madeira" ne se lit pas.
    const name = (title(h).split("|")[0] || title(h)).trim();
    const description = meta(h, "description");
    let out = h, changed = false;

    // 1. le partage: sans og:title, un lien colle dans WhatsApp sort nu
    if (!prop(h, "og:title")) {
      const enOg = prop(en, "og:image") || "https://chifbay.com/assets/og.jpg";
      const og = [
        `<meta property="og:type" content="website"/>`,
        `<meta property="og:title" content="${title(h).replace(/"/g, "&quot;")}"/>`,
        `<meta property="og:description" content="${description.replace(/"/g, "&quot;")}"/>`,
        `<meta property="og:url" content="${url}"/>`,
        `<meta property="og:image" content="${enOg}"/>`,
        `<meta name="twitter:card" content="summary_large_image"/>`,
      ].join("\n");
      out = out.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${og}`);
      if (out !== h) { changed = true; }
    }

    // 2. le schema, copie de la page anglaise et remise dans la langue
    if (!/application\/ld\+json/.test(out) && blocks.length) {
      const made = blocks.map((b) => localise(b, { url, lang, name, description })).filter(Boolean);
      if (made.length) {
        const tags = made.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n");
        out = out.replace(/<\/head>/i, `${tags}\n</head>`);
        changed = true; added += made.length;
      }
    }

    if (changed) {
      touched++;
      if (!DRY) writeFileSync(join(SITE, rel), out);
      console.log((DRY ? "[essai] " : "") + rel);
    }
  }
}

// La page anglaise privacy n a ni schema ni partage non plus.
for (const page of ["privacy.html", "terms.html"]) {
  const p = join(SITE, page);
  if (!existsSync(p)) continue;
  let h = readFileSync(p, "utf-8");
  if (prop(h, "og:title")) continue;
  const url = canonical(h) || `https://chifbay.com/${page}`;
  const og = [
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:title" content="${title(h).replace(/"/g, "&quot;")}"/>`,
    `<meta property="og:description" content="${meta(h, "description").replace(/"/g, "&quot;")}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    `<meta property="og:image" content="${prop(read("about.html"), "og:image")}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
  ].join("\n");
  const out = h.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${og}`);
  if (out !== h) { touched++; if (!DRY) writeFileSync(p, out); console.log((DRY ? "[essai] " : "") + page); }
}

console.log(`\n${touched} page(s) completee(s), ${added} bloc(s) de donnees structurees ajoute(s)`);
