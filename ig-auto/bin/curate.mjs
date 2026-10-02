#!/usr/bin/env node
// curate.mjs: turn the hand-picked sets in curated.json into queued carousels.
//
//   node bin/curate.mjs            queue every set not queued or posted yet
//   node bin/curate.mjs --replace <queue id>...   also drop these queue items
//
// Each photo is graded once from its original (leveller, 4:5 crop, look), so a
// set never carries a second grade. Sets go to the front of the carousel line
// (priority 0, in file order). A set already queued or posted is skipped, so
// running it twice changes nothing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT, SITE_ROOT, config, dropItem, ensureDirs, listQueue, newId, publicDir, readLedger, sha256, withLock, writeItem,
} from "../lib/queue.mjs";
import { normalise } from "../lib/image.mjs";
import { applyGrade } from "../lib/grade.mjs";
import { applyLook, LOOK } from "../lib/look.mjs";
import { writeManifest } from "../lib/manifest.mjs";

const args = process.argv.slice(2);
const drop = args[0] === "--replace" ? args.slice(1) : [];
const spec = JSON.parse(readFileSync(join(ROOT, "curated.json"), "utf-8"));

await withLock(async () => {
  ensureDirs();
  for (const id of drop) { dropItem(id); console.log(`dropped ${id}`); }
  const queued = new Set(listQueue().map((i) => i.set).filter(Boolean));
  const posted = new Set(readLedger().filter((e) => e.ok && e.set).map((e) => e.set));
  let order = 0;
  for (const s of spec.sets) {
    order++;
    if (queued.has(s.set) || posted.has(s.set)) { console.log(`${s.set}: already queued or posted`); continue; }
    const missing = s.slides.filter((x) => !existsSync(join(SITE_ROOT, x.origin)));
    if (missing.length) throw new Error(`${s.set}: original missing: ${missing.map((m) => m.origin).join(", ")}`);
    if (s.slides.length < 2 || s.slides.length > 10) throw new Error(`${s.set}: a carousel takes 2 to 10 photos`);
    if (/[–—]/.test(s.caption)) throw new Error(`${s.set}: a long dash in the caption`);
    const id = newId();
    const slides = [];
    for (const [i, x] of s.slides.entries()) {
      const buf = await applyLook(await normalise(await applyGrade(join(SITE_ROOT, x.origin)), "feed"));
      const file = `${id}-${i + 1}.jpg`;
      writeFileSync(join(publicDir, file), buf);
      slides.push({ origin: x.origin, alt: x.alt, image: `${config.public_dir}/${file}`, url: `${config.public_base}/${file}`, sha256: sha256(buf) });
    }
    const item = {
      id, kind: "feed", set: s.set, title: s.title, source: "curated", angle: "guests",
      created: `2026-01-01T00:00:0${order}.000Z`, priority: 0, fresh: true, look: LOOK.version,
      origin: slides[0].origin, image: slides[0].image, url: slides[0].url, sha256: slides[0].sha256, slides,
      alt: slides.map((x) => x.alt), caption: s.caption, hashtags: s.hashtags,
      rendered_caption: `${s.caption}\n\n${s.hashtags.join(" ")}`, writer: "claude",
    };
    writeItem(item);
    console.log(`${s.set}: queued as ${id} (${slides.length} photos)`);
  }
  writeManifest();
});
