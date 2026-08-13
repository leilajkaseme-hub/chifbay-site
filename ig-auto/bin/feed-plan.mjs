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
import { buildCarousels, dedupeLibrary, rows, worstJump, worstSwipe } from "../lib/feedplan.mjs";
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
  const { worstHue, whereHue, pairs, medianHue, p90Hue } = worstJump(order);
  console.log(`\nWARM-COLD step between touching squares, over ${pairs} pairs`);
  console.log(`  median ${medianHue.toFixed(1)}   9 in 10 under ${p90Hue.toFixed(1)}   worst ${worstHue.toFixed(1)}`);
  console.log(`  (the full library spans 98 points, so these are small steps)`);
  console.log(`  worst pair: ${whereHue}`);
  console.log(worstHue < 25
    ? "  nothing a visitor would read as the grid changing temperature"
    : "  A VISIBLE CLASH — look at the preview");

  console.log(`\nworst overall difference between neighbours: ${worst.toFixed(1)}`);
  console.log(`  ${where}`);
  console.log("  this one also counts brightness and red, so a dark frame next");
  console.log("  to a bright one at the same hue scores high. That is rhythm,");
  console.log("  not a clash — judge it in the preview, not by the number.");

  const sw = worstSwipe(order);
  console.log(`\nworst jump inside one post: ${sw.worst.toFixed(1)}`);
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

const all = await measureAll();
const { photos, dropped } = dedupeLibrary(all);
const carousels = buildCarousels(photos, { slides: SLIDES });
const order = carousels;   // buildCarousels already returns them in posting order

if (dropped.length) {
  console.log(`\n${dropped.length} duplicate photo(s) ignored — the library holds them twice:`);
  for (const d of dropped) console.log(`  ${d.dropped}\n    same picture as ${d.kept}`);
}
console.log(`\n${photos.length} unique photos -> ${carousels.length} carousels of up to ${SLIDES}`);

if (args.has("--report") || args.size === 0) report(order);
if (args.has("--preview")) await preview(order);

// --slides N renders one post's photos in a row, which is the only way to check
// the thing the grid preview cannot show: that a carousel is four different
// pictures and not four frames of one.
const slidesArg = process.argv.find((a) => a.startsWith("--slides"));
if (slidesArg) {
  const n = Number(slidesArg.split("=")[1] ?? 0);
  const post = order[n];
  if (!post) throw new Error(`there is no post ${n} — the plan has ${order.length}`);
  const CELL = 420, GAP = 6;
  const tiles = [];
  for (const [i, p] of post.slides.entries()) {
    tiles.push({
      input: await sharp(await applyGrade(p.path))
        .resize(CELL, Math.round(CELL * 1.25), { fit: "cover", position: "attention" })
        .toBuffer(),
      left: i * (CELL + GAP),
      top: 0,
    });
  }
  const out = join(ROOT, `post-${n}-slides.jpg`);
  await sharp({
    create: {
      width: post.slides.length * CELL + (post.slides.length - 1) * GAP,
      height: Math.round(CELL * 1.25), channels: 3, background: "#ffffff",
    },
  }).composite(tiles).jpeg({ quality: 88 }).toFile(out);
  console.log(`\npost ${n} (${post.family}): ${out}`);
  post.slides.forEach((p, i) => console.log(`  ${i + 1}. ${p.origin}`));
}

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
