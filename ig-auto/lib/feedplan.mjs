// feedplan.mjs — decides which photos go in a post together, and in what order
// the posts go out.
//
// The Instagram grid is three squares wide, and a new post pushes everything
// right and down. So the thing a visitor judges is not one photo, it is the ROW
// OF THREE this post lands in and the rows around it. That is the unit here.
//
// The look being built is a colour-block feed: neighbours share a palette, and
// the palette drifts slowly down the grid instead of jumping. Measured across
// this library, every photo sits somewhere on one continuous line:
//
//   amber sunsets      b* up to  +47   \
//   soft daylight                       |
//   neutral hull/deck  b* around   0    |  warm to cold, no gaps
//   azure ocean                         |
//   deep blue hour     b* down to -51   /
//
// Order the posts along that line and neighbours can never clash, because "next
// to each other in the grid" becomes the same thing as "next to each other in
// colour".
//
// WHY THE ORDER IS ONE STRAIGHT PASS, NOT A WAVE
// A wave was the first attempt — run warm to cold, then back. It cannot work
// while every cover is used once: to come back up the line you have to jump to
// the far end of it, and the report caught exactly that, a 48-point jump where
// two legs met. A single pass has no seam by construction. It is also not slow:
// 87 covers across the whole range is about one point of b* per post, so a
// visible grid of twelve spans a gentle gradient, and the palette only turns
// over across months. That is the drift a real brand feed has.
//
// WHY COVERS ARE UNIQUE BUT SLIDES ARE NOT
// Four fresh photos per post would empty an 87-photo library in 21 days. The
// cover is what lands in the grid and what people recognise, so it is used
// once. The three photos behind it are supporting cast: they may appear again
// later, just never in the same post, never in a post close by, and never as
// often as they would start to feel like filler.
import { distance, family, layoutDistance } from "./palette.mjs";

/** How many posts must pass before a supporting photo may be used again. */
const SLIDE_COOLDOWN = 8;

/**
 * The furthest a supporting photo may sit from its cover.
 *
 * This is a hard wall, not a preference. The first version only preferred close
 * colours while also rewarding a difference in brightness, and the brightness
 * reward won: it let a photo 44 points away onto slide 4 of an otherwise warm
 * post. A carousel that breaks its own palette halfway through is the same
 * fault as a grid that does, just where fewer people see it.
 */
const MAX_SLIDE_DISTANCE = 18;

/**
 * How far ahead the order may reach to avoid repeating a composition.
 *
 * Small on purpose. The colour gradient is the backbone and must survive; this
 * only lets a post jump a few places to dodge looking like its neighbour.
 */
const LOOKAHEAD = 7;

/** Below this, two covers are the same picture twice. */
const SAME_SHAPE = 0.75;

/**
 * The order the posts go out: warm covers first, cold last, but never the same
 * composition twice in a row or directly above itself in the grid.
 *
 * Warmth alone gave a flawless palette and a boring grid — nine "sun on the
 * horizon" frames stacked three rows deep, because they were all within a
 * couple of b* of each other. So warmth sets the backbone and a short
 * lookahead picks, from the next few candidates, the one that looks least like
 * what a visitor can already see: the post before it, and the post directly
 * above it, which is three back because the grid is three wide.
 */
export function orderCovers(photos, { perRow = 3 } = {}) {
  const striking = (p) => p.chroma * 0.7 + p.contrast * 0.5;
  const pool = [...photos].sort((a, b) => (b.b - a.b) || (striking(b) - striking(a)));

  const out = [];
  const skips = new Map();   // origin -> how many times it has been passed over

  while (pool.length) {
    const window = pool.slice(0, LOOKAHEAD);
    const neighbours = [out[out.length - 1], out[out.length - perRow]].filter(Boolean);

    let bestAt = 0, bestScore = -Infinity;
    window.forEach((cand, i) => {
      // Looking least like the neighbours is the point, so shape leads.
      // Position keeps the gradient honest: reaching six places ahead to find a
      // different-looking photo costs more than reaching one.
      const shape = neighbours.length
        ? Math.min(...neighbours.map((n) => layoutDistance(cand, n)))
        : 2;
      const colour = neighbours.length
        ? Math.max(...neighbours.map((n) => distance(cand, n)))
        : 0;

      // Staleness, and it is not a nicety — without it the plan ended with a
      // 94-point jump. Two warm photos happened to resemble whatever had just
      // been placed, lost the shape comparison every single round, and were
      // still unplaced when the feed had reached the cold end. Then they had to
      // go somewhere. Pressure that grows each time a photo is passed over
      // bounds that to about six positions, which is a couple of b* — invisible.
      // The grace period matters as much as the pressure. Charging from the
      // first skip made staleness outweigh shape within a few rounds and the
      // near-identical sunsets clumped back together. Free for four rounds,
      // then it climbs fast.
      const stale = Math.max(0, (skips.get(cand.origin) ?? 0) - 4) * 4;

      const score = Math.min(shape, 1.6) * 10 + stale - i * 1.1 - Math.max(0, colour - 20) * 0.8;
      if (score > bestScore) { bestScore = score; bestAt = i; }
    });

    window.forEach((cand, i) => {
      if (i !== bestAt) skips.set(cand.origin, (skips.get(cand.origin) ?? 0) + 1);
    });
    out.push(pool.splice(bestAt, 1)[0]);
  }
  return out;
}

/**
 * Fill each post out to `slides` photos.
 *
 * A carousel has one job: the cover earns the tap, the rest reward it. So the
 * supporting photos are close to the cover in colour — the swipe must not
 * break the palette either — but rewarded for differing in light, because four
 * near-identical sunsets is a boring swipe and reads as padding.
 */
export function buildCarousels(photos, { slides = 4 } = {}) {
  const covers = orderCovers(photos);
  const lastUsed = new Map();   // origin -> index of the post that last used it
  const out = [];

  covers.forEach((cover, index) => {
    // Everything allowed in this post: inside the palette wall around the
    // cover. That wall is absolute. The cooldown is only a preference between
    // photos that already fit — a photo repeating eight posts later is
    // invisible, a colour break mid-swipe is not.
    const near = photos
      .filter((p) => p.origin !== cover.origin && distance(cover, p) <= MAX_SLIDE_DISTANCE);

    const chain = [cover];
    const used = new Set([cover.origin]);

    while (chain.length < slides) {
      const here = chain[chain.length - 1];
      let best = null, bestScore = Infinity;
      for (const p of near) {
        if (used.has(p.origin)) continue;
        // Distance from the photo now on screen, because that is the step the
        // thumb actually makes. Choosing the set first and ordering it after
        // does not work: two photos can each sit 18 from the cover and 36 from
        // each other, and that is a 36-point jump on slide 3.
        const score =
          distance(here, p)
          - Math.min(18, Math.abs(here.brightness - p.brightness)) * 0.35
          + (index - (lastUsed.get(p.origin) ?? -Infinity) >= SLIDE_COOLDOWN ? 0 : 6);
        if (score < bestScore) { bestScore = score; best = p; }
      }
      if (!best) break;   // a lonely photo with no palette neighbours: post fewer slides
      chain.push(best);
      used.add(best.origin);
    }

    for (const p of chain) lastUsed.set(p.origin, index);

    out.push({
      cover,
      slides: chain,
      warmth: cover.b,
      family: family(cover),
    });
  });

  return out;
}

/** How the plan will look as rows of three, for the report. */
export function rows(list, perRow = 3) {
  const out = [];
  for (let i = 0; i < list.length; i += perRow) out.push(list.slice(i, i + perRow));
  return out;
}

/**
 * The number that says whether the plan is any good: the biggest colour jump
 * between two posts that end up touching in the grid. Touching means the post
 * before, the post after, and the post directly above — which is three back,
 * because the grid is three wide.
 */
export function worstJump(list, perRow = 3) {
  let worst = 0, where = null;
  for (let i = 1; i < list.length; i++) {
    for (const back of [1, perRow]) {
      if (i - back < 0) continue;
      const d = distance(list[i].cover, list[i - back].cover);
      if (d > worst) {
        worst = d;
        where = `${list[i - back].cover.origin} -> ${list[i].cover.origin}`;
      }
    }
  }
  return { worst, where };
}

/** Worst colour jump between two slides inside the same post. */
export function worstSwipe(list) {
  let worst = 0, where = null;
  for (const c of list) {
    for (let i = 1; i < c.slides.length; i++) {
      const d = distance(c.slides[i - 1], c.slides[i]);
      if (d > worst) {
        worst = d;
        where = `${c.cover.origin}: slide ${i} -> ${i + 1}`;
      }
    }
  }
  return { worst, where };
}
