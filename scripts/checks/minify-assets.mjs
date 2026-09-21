#!/usr/bin/env node
// minify-assets.mjs — ecrit une version minifiee de nos CSS et JS, et fait
// pointer les pages dessus.
//
// L audit comptait 359 avertissements "fichiers non minifies", et c est le plus
// gros paquet du rapport. Mesure sur la page d accueil: 156 ko de CSS et de JS
// ecrits a la main, dont 105 ko rien que pour peak.css et atlas.css.
//
// La regle qui rend ca sans danger: **on ne touche jamais au fichier source**.
// Le fichier ecrit a la main reste lisible et modifiable; on genere un
// `.min.css` / `.min.js` a cote, et seules les pages changent d adresse. Pour
// revenir en arriere il suffit de relancer ce script avec --undo.
//
// Lancer: node scripts/checks/minify-assets.mjs [--undo]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UNDO = process.argv.includes("--undo");

// Nos fichiers seulement. `vendor/` est deja minifie par ses auteurs, et
// `ig-auto/` ne part jamais dans une page.
const FILES = ["peak.css", "atlas.css", "booking.css", "motion.css",
               "peak.js", "atlas.js", "motion.js", "booking.js", "booking-content.js",
               "booking-config.js", "track.js", "fx.js", "map-home.js", "reviews-home.js"]
  .filter((f) => existsSync(join(SITE, f)));

function pages() {
  const out = [];
  const walk = (dir, depth) => {
    for (const e of readdirSync(join(SITE, dir), { withFileTypes: true })) {
      if (e.name.startsWith(".") || ["node_modules", "vendor", "ig-auto", "scripts", "assets", "data", "social-drive"].includes(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory() && depth < 3) walk(rel, depth + 1);
      else if (e.name.endsWith(".html")) out.push(rel);
    }
  };
  walk("", 0);
  return out;
}

let saved = 0;
if (!UNDO) {
  for (const f of FILES) {
    const src = join(SITE, f);
    const out = src.replace(/\.(css|js)$/, ".min.$1");
    execFileSync("npx", ["--yes", "esbuild", src, "--minify", "--charset=utf8", `--outfile=${out}`, "--allow-overwrite"],
      { cwd: SITE, stdio: ["ignore", "ignore", "inherit"] });
    const a = statSync(src).size, b = statSync(out).size;
    saved += a - b;
    console.log(`  ${f.padEnd(22)} ${(a / 1024).toFixed(1)} ko -> ${(b / 1024).toFixed(1)} ko`);
  }
}

let touched = 0;
for (const p of pages()) {
  const abs = join(SITE, p);
  let h = readFileSync(abs, "utf-8");
  const before = h;
  for (const f of FILES) {
    const base = f.replace(/\.(css|js)$/, "");
    const ext = f.split(".").pop();
    if (UNDO) {
      h = h.replace(new RegExp(`((?:href|src)="[^"]*?)${base}\\.min\\.${ext}"`, "g"), `$1${base}.${ext}"`);
    } else {
      h = h.replace(new RegExp(`((?:href|src)="[^"]*?)${base}\\.${ext}"`, "g"), `$1${base}.min.${ext}"`);
    }
  }
  if (h !== before) { writeFileSync(abs, h); touched++; }
}

if (UNDO) {
  for (const f of FILES) {
    const out = join(SITE, f.replace(/\.(css|js)$/, ".min.$1"));
    if (existsSync(out)) unlinkSync(out);
  }
  console.log(`\nretour en arriere: ${touched} page(s) repointee(s) sur les sources`);
} else {
  console.log(`\n${FILES.length} fichiers minifies, ${(saved / 1024).toFixed(0)} ko economises par page complete, ${touched} page(s) repointee(s)`);
}
