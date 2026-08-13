#!/usr/bin/env node
// feed-plan.mjs — plan the grid, and let a human look at it before it posts.
//
//   node bin/feed-plan.mjs --report     what the plan is, as text
//   node bin/feed-plan.mjs --preview    render feed-preview.jpg, the real grid
//   node bin/feed-plan.mjs --write      save the plan for topup.mjs to build
//
// Nothing here publishes and nothing here touches the queue unless you pass
// --write. The point of the preview is that "does this look good" is not a
// question you can answer by reading code — you have to see the squares.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { libraryFiles } from "../lib/image.mjs";
import { measure, family } from "../lib/palette.mjs";
import { applyGrade, gradeFor } from "../lib/grade.mjs";
import { buildCarousels, rows, worstJump, worstSwipe } from "../lib/feedplan.mjs";
import { config, ROOT, sha256 } from "../lib/queue.mjs";

const args = new Set(process.argv.slice(2));
const SLIDES = config.carousel_slides ?? 4;
const CACHE = join(ROOT, ".palette-cache.json");
const PLAN = join(ROOT, "feed-plan.json");
const PREVIEW = join(ROOT, "feed-preview.jpg");

/**
 * Measuring 87 photos means grading and reading every one of them, which is
 * slow, and the answer only changes when a photo does. So it is cached.
 *
 * Keyed on the CONTENT of the file, not its date. A git checkout stamps every
 * file with the time it was cloned, so an mtime key would miss on every single
 * CI run and the cache would be decoration.
 */
async function measureAll() {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const out = [];
  let fresh = 0;

  for (const f of libraryFiles()) {
    const key = `${f.origin}:${sha256(readFileSync(f.path)).slice(0, 16)}`;
    if (!cache[key]) {
      // Measure the photo AS IT WILL BE POSTED. Grading changes the colour, and
      // planning the grid from ungraded numbers would order a feed nobody sees.
      cache[key] = await measure(await applyGrade(f.path));
      fresh++;
    }
    out.push({ ...cache[key], origin: f.origin, path: f.path });
  }

  writeFileSync(CACHE, JSON.stringify(cache));
  if (fresh) console.log(`measured ${fresh} new photo(s)`);
  return out;
}

function report(order) {
  const { worst, where } = worstJump(order);
  console.log(`\n${order.length} posts planned, ${SLIDES} photos each\n`);
  rows(order).forEach((row, i) => {
    const line = row
      .map((c) => `${family(c.cover).padEnd(7)} b${c.warmth >= 0 ? "+" : ""}${c.warmth.toFixed(0).padStart(3)}`)
      .join("  |  ");
    console.log(`  row ${String(i + 1).padStart(2)}  ${line}`);
  });
  console.log(`\nworst jump between neighbours: ${worst.toFixed(1)}`);
  console.log(`  ${where}`);
  console.log(worst < 25
    ? "  under 25 — no visible clash in the grid"
    : "  ABOVE 25 — there is a jump a visitor would notice");

  const sw = worstSwipe(order);
  console.log(`worst jump inside one post:    ${sw.worst.toFixed(1)}`);
  console.log(`  ${sw.where}`);
}

/** The grid as Instagram will draw it: 3 wide, newest first, small gaps. */
async function preview(order, count = 18) {
  const CELL = 320, GAP = 4, COLS = 3;
  const take = order.slice(0, count);
  const width = COLS * CELL + (COLS - 1) * GAP;
  const height = Math.ceil(take.length / COLS) * (CELL + GAP) - GAP;

  const tiles = [];
  for (const [i, c] of take.entries()) {
    tiles.push({
      input: await sharp(await applyGrade(c.cover.path))
        .resize(CELL, CELL, { fit: "cover", position: "attention" })
        .toBuffer(),
      left: (i % COLS) * (CELL + GAP),
      top: Math.floor(i / COLS) * (CELL + GAP),
    });
  }

  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(tiles)
    .jpeg({ quality: 88 })
    .toFile(PREVIEW);
  console.log(`\npreview: ${PREVIEW}  (${take.length} posts, newest top-left)`);
}

// ----------------------------------------------------------------------------

const photos = await measureAll();
const carousels = buildCarousels(photos, { slides: SLIDES });
const order = carousels;   // buildCarousels already returns them in posting order

console.log(`${photos.length} photos -> ${carousels.length} carousels of ${SLIDES}`);

if (args.has("--report") || args.size === 0) report(order);
if (args.has("--preview")) await preview(order);

if (args.has("--write")) {
  writeFileSync(PLAN, JSON.stringify({
    built: new Date().toISOString(),
    slides: SLIDES,
    posts: order.map((c, i) => ({
      plan_index: i,
      family: c.family,
      warmth: Number(c.warmth.toFixed(2)),
      cover: c.cover.origin,
      slides: c.slides.map((p) => p.origin),
      grade: gradeFor(c.cover),
    })),
  }, null, 2));
  console.log(`\nplan written: ${PLAN}`);
}
