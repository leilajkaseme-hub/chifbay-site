// palette.mjs — what colour a photo actually is, and how far two photos sit
// apart. Everything about how the grid looks is decided from these numbers.
//
// Why CIELAB and not RGB or HSV. RGB distance does not match what the eye sees:
// two blues far apart in RGB can look identical, and two greens close in RGB
// can clash. CIELAB is built so that equal distances look equally different, so
// "these two photos sit well next to each other" becomes arithmetic.
//
//   L   0..100   how light it is
//   a   -128..127  green (-) to red (+)
//   b   -128..127  blue (-) to yellow (+)
//
// For a Madeira boat feed the useful reading is mostly b: a golden sunset is
// strongly +b, open ocean is strongly -b. Putting those two side by side is
// exactly the jump that makes a grid look thrown together.
// sharp is loaded inside measure(), not at the top. Everything else in this
// file is arithmetic, and the ordering tests need only the arithmetic — a
// top-level import would drag a native dependency into a test job that
// deliberately installs nothing, and the maths would go untested in CI.

/** sRGB channel 0..255 -> linear 0..1. */
function linear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

const F = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** sRGB -> CIELAB, D65. */
export function rgbToLab(r, g, b) {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  // sRGB D65 matrix, then normalise by the white point.
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B) / 1.0;
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const [fx, fy, fz] = [F(x), F(y), F(z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Measure one photo.
 *
 * The average of every pixel would be mud — average a sunset and you get grey.
 * So the photo is reduced to a small grid and each cell weighted by its own
 * colourfulness: a flat grey sky contributes little, the orange band and the
 * blue water contribute a lot. That gives the colour a person would name if you
 * asked them what the photo is, rather than the arithmetic mean.
 */
export async function measure(input) {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(input)
    .rotate()
    .resize(48, 48, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = [];
  for (let i = 0; i < data.length; i += info.channels) {
    px.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
  }

  const chromaOf = (p) => Math.hypot(p.a, p.b);
  let wSum = 0, L = 0, a = 0, b = 0;
  for (const p of px) {
    // +4 so a genuinely grey photo still has a defined average instead of 0/0.
    const w = chromaOf(p) + 4;
    wSum += w; L += p.L * w; a += p.a * w; b += p.b * w;
  }
  const mean = { L: L / wSum, a: a / wSum, b: b / wSum };

  const lights = px.map((p) => p.L).sort((x, y) => x - y);
  const at = (q) => lights[Math.min(lights.length - 1, Math.round(q * (lights.length - 1)))];

  return {
    ...mean,
    layout: layoutOf(px, 48),
    chroma: Math.hypot(mean.a, mean.b),          // how colourful, 0 = grey
    hue: (Math.atan2(mean.b, mean.a) * 180) / Math.PI, // -180..180, 90 = yellow, -90 = blue
    brightness: px.reduce((s, p) => s + p.L, 0) / px.length,
    // Real contrast, not max-minus-min: one blown highlight would make every
    // photo look high contrast.
    contrast: at(0.9) - at(0.1),
    warmth: mean.b,                              // the single number that decides the grid
  };
}

/**
 * Where the light sits in the frame, as a 5x5 grid — the photo's shape.
 *
 * Colour cannot see composition, and the first preview proved why that matters:
 * the grid was perfectly harmonious and still looked like stock, because the
 * top three rows were the same picture nine times over — sun on the horizon,
 * dead centre, water below. Every one of those is a different file with a
 * slightly different b*, so no colour rule would ever separate them.
 *
 * Each cell is normalised against the photo's own mean and spread, so this
 * describes STRUCTURE and not exposure: a bright sunset and a dark one with the
 * sun in the same place score as the same shape, which is exactly the pair that
 * must not sit side by side.
 */
function layoutOf(px, side) {
  const N = 5;
  const cells = Array.from({ length: N * N }, () => ({ sum: 0, n: 0 }));
  px.forEach((p, i) => {
    const row = Math.min(N - 1, Math.floor(Math.floor(i / side) / (side / N)));
    const col = Math.min(N - 1, Math.floor((i % side) / (side / N)));
    const c = cells[row * N + col];
    c.sum += p.L; c.n++;
  });
  const vals = cells.map((c) => (c.n ? c.sum / c.n : 0));
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1;
  return vals.map((v) => (v - mean) / sd);
}

/**
 * How differently two photos are composed, 0 = same shape.
 *
 * Around 0.4 and below means "the same picture twice". Above about 1.2 they
 * read as genuinely different shots.
 */
export function layoutDistance(p, q) {
  if (!p.layout || !q.layout) return 1;
  let sum = 0;
  for (let i = 0; i < p.layout.length; i++) sum += (p.layout[i] - q.layout[i]) ** 2;
  return Math.sqrt(sum / p.layout.length);
}

/**
 * How badly two photos clash, 0 = identical.
 *
 * b is weighted hardest because warm-to-cold is the jump the eye catches first
 * and the one this whole feature exists to stop. L is weighted least: a light
 * photo next to a darker one in the same palette reads as rhythm, not as a
 * mistake, and is actually wanted.
 */
export function distance(p, q) {
  return Math.hypot(
    (p.L - q.L) * 0.45,
    (p.a - q.a) * 1.0,
    (p.b - q.b) * 1.35,
  );
}

/**
 * The colour families this library actually contains, named so a human can
 * argue with the grouping. Thresholds come from measuring all 87 photos, not
 * from theory — see `node bin/feed-plan.mjs --report`.
 */
export function family(m) {
  if (m.chroma < 9) return "neutral";              // hull, deck, detail shots
  if (m.b > 14) return m.brightness > 55 ? "golden" : "amber";  // sunset, warm light
  if (m.b < -8) return m.brightness > 50 ? "azure" : "deep";    // ocean, sky, blue hour
  if (m.a < -4) return "verdant";                  // cliffs, terraces
  return "soft";                                   // hazy, low-colour daylight
}

/** Ordered warm -> cold, so a run of families can be walked without a jump. */
export const FAMILY_ORDER = ["golden", "amber", "soft", "neutral", "verdant", "azure", "deep"];
