/**
 * Puts the "Included" block on the home page, the experiences page and both
 * trip pages, in every language: drone video, Insta360 video and phone photos,
 * each shown with the real footage from a trip.
 *
 * All three tiles say "Included": the owner confirmed on 2 Oct 2026 that the
 * Insta360 video comes with every trip, not only the 3h day trip. The booking
 * API publishes the same list (includedMedia in /v1/catalogue).
 *
 *   node scripts/add-media-included.mjs           dry run
 *   node scripts/add-media-included.mjs --write   apply
 *
 * Safe to run again: it removes the block it wrote before and writes it fresh.
 *
 * Where it goes on each page is chosen by a marker that exists in all six
 * languages, because the pages are translations of one layout:
 *   home         before the full-bleed photo that follows the two trips
 *   experiences  after the trip cards
 *   trip pages   before the closing "reserve" band
 *
 * The clips are 6 seconds, muted, 540 x 676, under 700 KB each, and do not
 * load until the block is near the screen (preload="none" plus the observer
 * below). A visitor who asks for reduced motion sees the poster only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webpify } from "./lib/webp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const T = {
  en: { i360k: "Included", k: "Included", h: "You leave with <em>the whole trip</em> on film",
        p: "Nothing extra to pay and nothing to set up. We film and photograph the trip and send it all to you after.",
        drone: ["Drone footage from above", "Aerial shots of your boat under Cabo Girão and in the coves, weather allowing."],
        i360: ["Insta360 360° video", "360° footage from on board, reframed so you are in every shot."],
        phone: ["Camera photos", "High quality photos of your group taken with a real camera through the whole trip, sent to you after."] },
  fr: { i360k: "Inclus", k: "Inclus", h: "Vous repartez avec <em>toute la sortie</em> en images",
        p: "Rien à payer en plus, rien à préparer. Nous filmons et photographions la sortie et nous vous envoyons tout après.",
        drone: ["Images de drone vues du ciel", "Des images aériennes de votre bateau sous Cabo Girão et dans les criques, si la météo le permet."],
        i360: ["Vidéo 360° Insta360", "Des images à 360° prises à bord, recadrées pour que vous soyez dans chaque plan."],
        phone: ["Photos à l'appareil", "Des photos de qualité de votre groupe, prises avec un vrai appareil photo pendant toute la sortie, envoyées après."] },
  de: { i360k: "Inklusive", k: "Inklusive", h: "Sie nehmen <em>die ganze Fahrt</em> mit nach Hause",
        p: "Kein Aufpreis, nichts vorzubereiten. Wir filmen und fotografieren die Fahrt und schicken Ihnen danach alles.",
        drone: ["Drohnenaufnahmen von oben", "Luftaufnahmen Ihres Boots unter Cabo Girão und in den Buchten, wenn das Wetter es erlaubt."],
        i360: ["Insta360-360°-Video", "360° Aufnahmen an Bord, so zugeschnitten, dass Sie in jeder Szene sind."],
        phone: ["Kamerafotos", "Hochwertige Fotos Ihrer Gruppe mit einer echten Kamera, während der ganzen Fahrt, danach zugeschickt."] },
  pt: { i360k: "Incluído", k: "Incluído", h: "Leva <em>o passeio inteiro</em> em imagens",
        p: "Sem custo extra e nada a preparar. Filmamos e fotografamos o passeio e enviamos tudo depois.",
        drone: ["Imagens de drone vistas de cima", "Imagens aéreas do seu barco sob o Cabo Girão e nas enseadas, se o tempo permitir."],
        i360: ["Vídeo 360° Insta360", "Imagens a 360° a bordo, reenquadradas para estar em todos os planos."],
        phone: ["Fotos de câmara", "Fotos de qualidade do seu grupo, tiradas com uma câmara a sério durante todo o passeio, enviadas depois."] },
  es: { i360k: "Incluido", k: "Incluido", h: "Te llevas <em>toda la salida</em> en imágenes",
        p: "Sin coste extra y nada que preparar. Filmamos y fotografiamos la salida y te lo enviamos todo después.",
        drone: ["Imágenes de dron desde arriba", "Imágenes aéreas de tu barco bajo Cabo Girão y en las calas, si el tiempo lo permite."],
        i360: ["Vídeo 360° Insta360", "Imágenes 360° a bordo, reencuadradas para que salgas en cada plano."],
        phone: ["Fotos con cámara", "Fotos de calidad de tu grupo, hechas con una cámara de verdad durante toda la salida, enviadas después."] },
  it: { i360k: "Incluso", k: "Incluso", h: "Porti a casa <em>tutta l'uscita</em> in video",
        p: "Nessun costo extra e niente da preparare. Filmiamo e fotografiamo l'uscita e ti mandiamo tutto dopo.",
        drone: ["Riprese con il drone dall'alto", "Riprese aeree della tua barca sotto Cabo Girão e nelle calette, meteo permettendo."],
        i360: ["Video 360° Insta360", "Riprese a 360° a bordo, reinquadrate perché tu sia in ogni scena."],
        phone: ["Foto con fotocamera", "Foto di qualità del tuo gruppo, scattate con una vera fotocamera per tutta l'uscita, inviate dopo."] },
};

// page (relative to a language folder) -> the marker the block goes before
const PAGES = {
  "index.html": '<section class="bleed">',
  "experiences.html": '<section class="pad" style="padding-top:0">',
  "hidden-coves-half-day.html": '<section class="reserve"',
  "sunset-cruise.html": '<section class="reserve"',
};
const LANGS = ["", "fr", "de", "pt", "es", "it"];

const OLD = /[ \t]*<!-- media-included -->[\s\S]*?<!-- \/media-included -->\n?/g;

function tile(prefix, kind, t, k) {
  const [title, desc] = t;
  const media = kind === "phone"
    ? `<img src="${prefix}assets/media/phone.jpg" alt="" loading="lazy" decoding="async">`
    : `<video muted loop playsinline preload="none" aria-hidden="true" poster="${prefix}assets/media/${kind}-poster.jpg" data-src="${prefix}assets/media/${kind}.mp4"></video>`;
  const bg = kind === "phone" ? "phone.jpg" : `${kind}-poster.jpg`;
  return `      <figure class="mi reveal" style="background:url('${prefix}assets/media/${bg}') center/cover">${media}` +
         `<figcaption><span class="mi-k">${k}</span><b>${title}</b><span class="mi-d">${desc}</span></figcaption></figure>\n`;
}

function block(lang, prefix) {
  const t = T[lang];
  return `<!-- media-included -->
<section class="chapter minc" style="padding-top:0">
  <div class="wrap-w">
    <div class="chead reveal"><span class="cl">${t.k}</span></div>
    <h2 class="display reveal" style="font-size:clamp(1.9rem,3.6vw,3.1rem);max-width:18ch">${t.h}</h2>
    <p class="minc-lead reveal d1">${t.p}</p>
    <div class="minc-grid">
${tile(prefix, "drone", t.drone, t.k)}${tile(prefix, "insta360", t.i360, t.i360k)}${tile(prefix, "phone", t.phone, t.k)}    </div>
  </div>
<script>
(function(){var vs=document.querySelectorAll('.minc video[data-src]');if(!vs.length)return;
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
function go(v){if(!v.src){v.src=v.getAttribute('data-src');}var p=v.play();if(p&&p.catch)p.catch(function(){});}
if(!('IntersectionObserver' in window)){vs.forEach(go);return;}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){go(e.target);}else if(e.target.src){e.target.pause();}});},{rootMargin:'200px'});
vs.forEach(function(v){io.observe(v);});})();
</script>
</section>
<!-- /media-included -->
`;
}

let changed = 0, missing = [];
for (const lang of LANGS) {
  for (const [page, marker] of Object.entries(PAGES)) {
    const rel = lang ? path.join(lang, page) : page;
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { missing.push(rel + " (no file)"); continue; }
    const before = fs.readFileSync(file, "utf8");
    let html = before.replace(OLD, "");
    const at = html.indexOf(marker);
    if (at === -1) { missing.push(rel + " (no marker)"); continue; }
    const code = (html.match(/<html[^>]*\slang="([a-z]{2})/i) || [, "en"])[1].toLowerCase();
    html = html.slice(0, at) + block(T[code] ? code : "en", lang ? "../" : "") + html.slice(at);
    html = webpify(html, file);   // same photo markup as scripts/use-webp.mjs
    if (html !== before) { changed++; if (WRITE) fs.writeFileSync(file, html); }
  }
}
console.log(WRITE ? "WRITTEN" : "DRY RUN (add --write)", "pages changed:", changed);
if (missing.length) console.log("skipped:", missing.join(", "));
