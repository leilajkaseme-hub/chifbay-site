#!/usr/bin/env node
// publish.mjs: put today's Journal post in place from the queue. No AI, no network.
//
//   node scripts/journal/publish.mjs          prints PUBLISHED <slug>, ALREADY <slug> or EMPTY
//
// Picks the oldest queued post that has its ChatGPT photos; if none has them yet, the
// oldest one anyway (it then keeps the real photo the writer chose from the site's
// library, and gen-post-images.mjs may add pictures after). Writes posts/<slug>.html,
// prepends posts.json, adds the sitemap line, copies the photos to assets/journal/,
// and changes the date the draft carries to today. Removes the queue folder.
// A post already dated today means the day is done: nothing happens (runs are retried
// several times a day, and the cron of GitHub drifts by hours).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IMAGE_NAMES, POSTS_JSON, ROOT, longDate, queueItems, readPosts, seoFile, today } from "./lib.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function figure(src, alt) {
  return `\n      <figure style="margin:36px 0;text-align:center">
        <img src="${src}" alt="${esc(alt)}" loading="lazy" style="width:100%;height:auto;border-radius:8px;display:block"/>
        <figcaption style="font-family:'Space Mono',monospace;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:10px">${esc(alt)}</figcaption>
      </figure>\n`;
}

/** The draft's date (ISO and long form) becomes `day`. */
export function redate(html, from, day) {
  if (!from || from === day) return html;
  return html.split(from).join(day).split(longDate(from)).join(longDate(day));
}

/** Hero, share image and JSON-LD image point at the new photo; two photos go into the body. */
export function wireImages(html, files, alts) {
  const hero = `assets/journal/${files[0]}.jpg`;
  const abs = `https://chifbay.com/${hero}`;
  html = html.replace(/background-image:url\('[^']*'\)/, `background-image:url('../${hero}')`);
  // The template also offers a WebP of the hero; use-webp.mjs rewrites it after make-webp.py runs.
  html = html.replace(/background-image:image-set\([^;"]*\)/, `background-image:url('../${hero}')`);
  html = html.replace(/(property="og:image" content=")[^"]*(")/, `$1${abs}$2`);
  html = html.replace(/("image":\s*")[^"]*(")/, `$1${abs}$2`);
  const body = html.indexOf('<p class="lede"');
  const ends = [...html.matchAll(/<\/p>/g)].map((m) => m.index + 4).filter((i) => i > body);
  if (ends.length >= 3) {
    const spots = [[ends[1], figure(`../assets/journal/${files[1]}.jpg`, alts[1])],
                   [ends[Math.floor((ends.length * 2) / 3)], figure(`../assets/journal/${files[2]}.jpg`, alts[2])]];
    if (spots[1][0] === spots[0][0]) spots.pop();
    for (const [pos, frag] of spots.sort((a, b) => b[0] - a[0])) html = html.slice(0, pos) + frag + html.slice(pos);
  }
  return html;
}

const SPARE_HEROES = ["assets/journal/boat-deck-horizon-ginger-calm-sea-madeira", "assets/journal/madeira-autumn-calm-sea-soft-golden-light"];

export function publish({ day = today(), log = console.log } = {}) {
  const posts = readPosts();
  if (posts[0]?.date === day) { log(`ALREADY ${posts[0].slug}`); return { state: "already", slug: posts[0].slug }; }
  const items = queueItems().filter((i) => !posts.some((p) => p.slug === i.slug));
  const item = items.find((i) => i.images) || items[0];
  if (!item) { log("EMPTY"); return { state: "empty" }; }

  const { slug, dir, meta } = item;
  let html = redate(readFileSync(join(dir, "post.draft"), "utf8"), meta.written, day);
  const entry = { ...meta, date: day };
  for (const k of ["written", "images", "queued", "imagePrompts", "photo"]) delete entry[k];
  if (item.images) {
    mkdirSync(join(ROOT, "assets", "journal"), { recursive: true });
    const alts = [0, 1, 2].map((i) => meta.images?.[i]?.alt || (i ? meta.title : meta.heroAlt || meta.title));
    // Each photo is named after what it shows (search engines read the file name), not after the queue slot.
    const taken = [];
    const files = IMAGE_NAMES.map((n, i) => {
      const f = seoFile(alts[i], taken); taken.push(f);
      copyFileSync(join(dir, `${n}.jpg`), join(ROOT, "assets", "journal", `${f}.jpg`));
      return f;
    });
    html = wireImages(html, files, alts);
    entry.heroImage = `assets/journal/${files[0]}.jpg`;
    if (alts[0]) entry.heroAlt = alts[0];
  }
  if (!item.images) {
    // A writer may have named a hero the photo job has not made yet. Never publish a broken picture:
    // use a ChatGPT photo that is already on the site until the real one exists.
    const base = String(entry.heroImage ?? "").replace(/\.(jpe?g|webp)$/i, "");
    if (base && !existsSync(join(ROOT, `${base}.jpg`))) {
      const spare = SPARE_HEROES.find((b) => existsSync(join(ROOT, `${b}.jpg`)));
      if (spare) { html = html.split(base).join(spare); entry.heroImage = `${spare}.jpg`; log(`hero ${base} is missing, using ${spare}`); }
    }
  }
  if (!html.includes(`/posts/${slug}`)) throw new Error(`${slug}: the draft does not carry its own canonical URL`);
  writeFileSync(join(ROOT, "posts", `${slug}.html`), html);
  writeFileSync(POSTS_JSON, JSON.stringify([entry, ...posts], null, 2) + "\n");

  const sm = join(ROOT, "sitemap.xml");
  let xml = readFileSync(sm, "utf8");
  const loc = `https://chifbay.com/posts/${slug}`;
  if (!xml.includes(`<loc>${loc}</loc>`)) {
    xml = xml.replace("</urlset>", `  <url><loc>${loc}</loc><lastmod>${day}</lastmod><changefreq>monthly</changefreq></url>\n</urlset>`);
    writeFileSync(sm, xml);
  }
  rmSync(dir, { recursive: true, force: true });
  log(`PUBLISHED ${slug}${item.images ? " (ChatGPT photos)" : " (no ChatGPT photos yet)"}; ${items.length - 1} left in the queue`);
  return { state: "published", slug, images: item.images, left: items.length - 1 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { publish(); } catch (e) { console.error(`publish failed: ${e.message}`); process.exit(1); }
}
