#!/usr/bin/env node
// verify-post-images.mjs — echoue si une page d article montre une image qui
// n existe pas.
//
// Pourquoi: `scripts/blog-local/gen-post-images.mjs` est volontairement "best
// effort", il sort en 0 quand Pollinations rate. La page, elle, garde quand
// meme le lien vers l image. Resultat mesure le 21 septembre 2026: cinq images
// manquantes, deux articles avec un cadre vide en ligne depuis des semaines, et
// personne ne l avait vu. C est Semrush qui l a dit avant nous.
//
// Lancer: node scripts/checks/verify-post-images.mjs
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIN = 5000; // un fichier plus petit n est pas une photo, c est un echec ecrit sur le disque

function pages() {
  const out = [];
  for (const dir of ["posts", "fr/posts", "de/posts", "pt/posts", "es/posts", "it/posts"]) {
    const abs = join(SITE, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (f.endsWith(".html")) out.push(join(dir, f));
  }
  return out;
}

let bad = 0, seen = 0;
for (const rel of pages()) {
  const html = readFileSync(join(SITE, rel), "utf-8");
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|background-image:url\(')\s*=?\s*["']?((?:\.\.\/)?assets\/journal\/[^"')]+)/g))
    refs.add(m[1].replace(/^\.\.\//, ""));
  for (const src of refs) {
    seen++;
    const abs = join(SITE, src);
    if (!existsSync(abs)) { bad++; console.log(`MANQUE   ${src}  <- ${rel}`); }
    else if (statSync(abs).size < MIN) { bad++; console.log(`VIDE     ${src} (${statSync(abs).size} o)  <- ${rel}`); }
  }
}
console.log(`\n${seen} image(s) d article verifiee(s), ${bad} probleme(s)`);
process.exit(bad ? 1 : 0);
