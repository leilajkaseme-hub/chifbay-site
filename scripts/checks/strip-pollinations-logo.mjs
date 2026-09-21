#!/usr/bin/env node
// strip-pollinations-logo.mjs — enleve le filigrane "pollinations.ai" d une
// image d article.
//
// Pollinations a cesse d honorer `nologo=true` sur son acces gratuit vers le
// 17 septembre 2026: depuis, chaque image du Journal est publiee avec le nom du
// generateur ecrit en bas a droite. Personne ne s en etait apercu, l article du
// jour en portait un. Un filigrane d un tiers sur les photos d une entreprise
// qui vend des sorties en mer, ce n est pas un detail de referencement.
//
// La methode: on coupe 5 % en bas, on recadre de la meme proportion en largeur
// pour garder exactement les memes proportions, puis on remet a la taille
// d origine. C est un zoom de 5 %, invisible a l oeil, et ca ne deforme rien.
//
// Lancer sur un fichier:   node scripts/checks/strip-pollinations-logo.mjs <img> [...]
// Lancer sur tout le dossier: node scripts/checks/strip-pollinations-logo.mjs --all
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CUT = 0.05;

function tool() {
  for (const t of ["magick", "convert"]) {
    try { execFileSync(t, ["-version"], { stdio: "ignore" }); return t; } catch {}
  }
  return null;
}

export function stripLogo(file, bin = tool()) {
  if (!bin) { console.log("ImageMagick absent, image laissee telle quelle:", file); return false; }
  const size = execFileSync(bin, ["identify", "-format", "%w %h", file]).toString().trim().split(" ");
  if (bin === "convert") {
    // `convert identify` n existe pas: on relit autrement.
    const s = execFileSync("identify", ["-format", "%w %h", file]).toString().trim().split(" ");
    size[0] = s[0]; size[1] = s[1];
  }
  const w = +size[0], h = +size[1];
  if (!w || !h) return false;
  const nw = Math.round(w * (1 - CUT)), nh = Math.round(h * (1 - CUT));
  const x = Math.round((w - nw) / 2);
  const args = bin === "magick" ? [file] : [file];
  execFileSync(bin, [...args,
    "-crop", `${nw}x${nh}+${x}+0`, "+repage",
    "-resize", `${w}x${h}!`, "-quality", "88", file]);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith("strip-pollinations-logo.mjs")) {
  const bin = tool();
  let files = process.argv.slice(2);
  if (files[0] === "--all") {
    const dir = join(SITE, "assets", "journal");
    files = readdirSync(dir).filter((f) => f.endsWith(".jpg")).map((f) => join(dir, f));
  }
  let n = 0;
  for (const f of files) {
    if (!existsSync(f) || statSync(f).size < 5000) { console.log("ignore:", f); continue; }
    if (stripLogo(f, bin)) { n++; console.log("nettoye:", f.split("/").pop()); }
  }
  console.log(`\n${n} image(s) recadree(s)`);
}
