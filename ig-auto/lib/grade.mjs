// grade.mjs — the one look every photo gets, so 87 pictures taken on different
// days with different cameras read as one feed.
//
// Ordering photos by colour only goes so far. Two sunsets sit next to each
// other happily; a sunset shot on a phone next to a sunset shot on a GoPro does
// not, because one is crushed and orange and the other is flat and pale. What
// makes a real brand feed look deliberate is that everything has been through
// the same edit.
//
// This is deliberately a LEVELLER, not a filter. It has no mood of its own: it
// measures the photo and moves it towards the middle of the house look, capped
// so it can never wreck a picture. The rules, in the order they matter:
//
//   1. Pull extreme colour back. A +47 b* sunset and a -51 b* ocean are the two
//      photos that ruin a grid. Chroma above the ceiling is compressed, not
//      clipped, so a sunset stays a sunset — it just stops shouting.
//   2. Match exposure. Everything moves towards a middle band, never more than
//      a few stops-worth, so no post is the one dark square in the grid.
//   3. One shared tone curve. A small shadow lift and a gentle S — the thing
//      people read as "edited" rather than "straight off the camera".
//   4. A touch of warmth on everything, including the blues. Shared warmth is
//      what makes a mixed set feel like one place.
//
// Every step is clamped. Run `node bin/feed-plan.mjs --preview` and look at the
// result before changing any number here.
import sharp from "sharp";
import { measure } from "./palette.mjs";

export const LOOK = {
  // Brightness target. Photos are nudged towards this, never pinned to it —
  // a feed where every square is the same brightness is flat and lifeless.
  targetL: 56,
  maxBrightnessShift: 0.16,   // +/- 16% brightness, no more

  // Colour ceiling. Measured across the library: the warmest photo is b +47
  // and the coldest is b -51. Anything past this gets compressed towards it.
  chromaCeiling: 34,
  minSaturation: 0.78,        // never wash a photo out past this

  // The shared curve. Small numbers on purpose.
  shadowLift: 6,              // 0..255, stops blacks being pure black
  contrast: 1.06,
  warmth: 1.012,              // red channel gain; blue is reduced by the same
};

/**
 * Work out what this specific photo needs to join the house look.
 * Returned separately from applying it so the preview can show the numbers and
 * so it can be tested without producing an image.
 */
export function gradeFor(m, look = LOOK) {
  // Brightness: close the gap to the target, but only part of the way. Going
  // all the way would flatten the feed into one grey tone.
  const wanted = look.targetL / Math.max(20, m.brightness);
  const brightness = clamp(1 + (wanted - 1) * 0.55, 1 - look.maxBrightnessShift, 1 + look.maxBrightnessShift);

  // Saturation: only the photos above the ceiling are touched at all.
  const saturation = m.chroma > look.chromaCeiling
    ? clamp(look.chromaCeiling / m.chroma, look.minSaturation, 1)
    : 1;

  return { brightness, saturation };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Put a photo through the house look.
 *
 * Order matters. Exposure and saturation are corrections and happen first, on
 * the real photo. The curve and the warmth are the shared style and go last, so
 * every photo ends on exactly the same two steps and therefore matches.
 */
export async function applyGrade(input, look = LOOK) {
  const m = await measure(input);
  const { brightness, saturation } = gradeFor(m, look);

  // linear(a, b) is out = in * a + b. Together the two calls are a shadow lift
  // plus a contrast pivot around mid grey, which is the whole "film" curve.
  const lifted = look.contrast;
  const offset = look.shadowLift - 128 * (lifted - 1);

  return sharp(input)
    .rotate()
    .modulate({ brightness, saturation })
    .linear(lifted, offset)
    .recomb([
      [look.warmth, 0, 0],
      [0, 1, 0],
      [0, 0, 2 - look.warmth],
    ])
    .toBuffer();
}
