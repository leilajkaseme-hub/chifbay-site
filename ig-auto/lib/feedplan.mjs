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
 * Two photos are TWINS when they are close in colour AND shaped the same.
 *
 * That combination is what "from the same shoot" looks like to a measuring
 * program: same light, same framing, shutter pressed twice. Twins must never
 * share a post and must never touch in the grid. Four of them in one carousel
 * looks cheap however good each frame is, and it is the single fastest way to
 * make a real business look like a stock account.
 */
export function areTwins(a, b) {
  return distance(a, b) < 9 && layoutDistance(a, b) < 1.0;
}

/**
 * How different two photos in the same post must look.
 *
 * The first version chose each slide by picking the CLOSEST remaining photo in
 * colour, which is precisely a machine for collecting near-duplicates. Inside a
 * post the palette is already guaranteed by the wall above, so the selection
 * has nothing left to optimise for except being a different picture — a
 * different point of view, a different subject, a different distance.
 */
const MIN_SHAPE_IN_POST = 1.05;

/** How different a post must look from the ones touching it in the grid. */
const MIN_SHAPE_IN_GRID = 0.85;

/**
 * The most colour two touching squares may differ by. This is the number the
 * whole feature exists to hold down, so it is checked before anything else.
 */
const MAX_GRID_JUMP = 22;

/** The most WARM-COLD (b*) change allowed between two touching squares. */
const MAX_HUE_JUMP = 12;

/**
 * How far ahead the order may look. Wide enough that the colour filter and the
 * shape filter can usually both be satisfied at once; narrow enough that the
 * gradient is never abandoned to chase a different-looking picture.
 */
const LOOKAHEAD_WIDE = 10;

/** Skipped this many times and a photo is placed regardless of any filter. */
const FORCE_AFTER = 6;

/**
 * Throw away photos the library holds more than once.
 *
 * This has to happen before anything else, because no ordering rule can save a
 * plan whose input contains the same picture twice — the best it can do is put
 * the two copies far apart, and they still both go out. It showed up in the
 * preview as two identical squares side by side.
 *
 * There are two kinds here. Five pairs are byte-for-byte the same file kept in
 * both `klook-photos/` and `clickandboat-sunset-photos/` — the same photos were
 * uploaded to two different channels. Four more are near-identical frames from
 * the same burst. Both kinds measure as shape ~0 and colour ~0, so one test
 * catches them.
 *
 * The survivor is the one with more contrast, which is usually the less
 * compressed copy, and the origin string breaks ties so the choice is stable
 * from run to run.
 */
export function dedupeLibrary(photos) {
  const dropped = [];
  const kept = [];

  for (const p of photos) {
    const twin = kept.find((k) => layoutDistance(k, p) < 0.35 && distance(k, p) < 12);
    if (!twin) { kept.push(p); continue; }

    const better = (p.contrast - twin.contrast) || twin.origin.localeCompare(p.origin);
    if (better > 0) {
      kept[kept.indexOf(twin)] = p;
      dropped.push({ dropped: twin.origin, kept: p.origin });
    } else {
      dropped.push({ dropped: p.origin, kept: twin.origin });
    }
  }
  return { photos: kept, dropped };
}

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
export function orderCovers(photos, { perRow = 3, placed = [] } = {}) {
  const striking = (p) => p.chroma * 0.7 + p.contrast * 0.5;

  // WHERE THE GRID ALREADY IS
  //
  // A fresh plan starts at the warm end because nothing is on the grid yet. A
  // REPLAN cannot: by then the feed has drifted some way down the warm-to-cold
  // line, and starting over would put a sunset directly above the blue-hour
  // photo that went out yesterday. That is the single worst thing this file
  // exists to prevent, and it is exactly what adding photos used to trigger.
  //
  // So the pass resumes. `placed` is the tail of the grid — the newest covers,
  // oldest first — and everything is measured from the last of them.
  const anchor = placed.length ? placed[placed.length - 1] : null;

  const warmToCold = (a, b) => (b.b - a.b) || (striking(b) - striking(a));
  const coldToWarm = (a, b) => (a.b - b.b) || (striking(b) - striking(a));

  let pool;
  if (!anchor) {
    pool = [...photos].sort(warmToCold);
  } else {
    // AHEAD is everything the drift can still reach going down the line. The
    // cutoff is one allowed step ABOVE the anchor, not the anchor itself: a
    // photo two points warmer than yesterday's post is the perfect next post,
    // and an exact split banished it to the far end of the plan — measured, a
    // single new sunset landed between two blue-hour squares, 73 points from
    // both. One step of slack costs nothing and fixes that whole class.
    const ahead = photos.filter((p) => p.b <= anchor.b + MAX_HUE_JUMP).sort(warmToCold);
    const behind = photos.filter((p) => p.b > anchor.b + MAX_HUE_JUMP).sort(coldToWarm);

    // Anything genuinely warmer than the drift can only be reached by going
    // back up, and WHERE that happens decides how bad it looks.
    //
    // Enough of them to fill rows: they become a real return leg. The pass runs
    // down to the cold end, turns, and climbs — no seam, because the turn is at
    // the bottom where the two legs meet at the same colour. This is what the
    // original "wave" could not do, and it works now only because the pool
    // refills between legs instead of holding photos back.
    //
    // Too few to fill a row: there is no leg, only a spike. At the end it sits
    // surrounded by cold on every side; at the FRONT it touches the grid once
    // and then the plan descends away from it. One bad pair beats three.
    pool = behind.length >= perRow ? [...ahead, ...behind] : [...behind, ...ahead];
  }

  // The grid tail is seeded into `out` so the first new post is judged against
  // the real squares it will sit next to, then stripped off before returning.
  const out = [...placed];
  const keep = placed.length;
  const skips = new Map();   // origin -> how many times it has been passed over

  while (pool.length) {
    const window = pool.slice(0, LOOKAHEAD_WIDE);
    const neighbours = [out[out.length - 1], out[out.length - perRow]].filter(Boolean);

    // Two filters, and the ORDER of them is the design decision.
    //
    // Colour first and hardest: a warm square against a cold one is the thing
    // that makes a grid look thrown together, and it is visible from across the
    // room. Shape second: a repeated composition looks cheap, but only once you
    // are actually looking. Filtering on shape first pushed the worst colour
    // jump from 24 to 38, because it left the colour choice nothing to work
    // with. This way shape gets everything colour can spare and no more.
    //
    // Each filter falls back to the pool it narrowed if it empties. Late in the
    // plan the leftovers can all resemble each other, and refusing to place
    // anything is not an option.
    // Nothing may be passed over for ever. A hard filter can exclude the same
    // photo every single round — a warm one keeps failing the colour test once
    // the feed has moved to the cold end — and then it is still unplaced at the
    // very end and lands 112 points from its neighbour. This is the guard, and
    // it has to sit ABOVE the filters, because a score cannot rescue a
    // candidate that was filtered out before scoring.
    //
    // Forcing it in here is cheap: the pool is warmth-sorted, so the head of it
    // is always the closest remaining photo in colour to where the feed is now.
    // Even a forced placement keeps the twin ban. Bypassing every rule put two
    // frames of the same shot next to each other at position 47 — the guard
    // against one fault must not create another. Only if every overdue
    // candidate is a twin of a neighbour does the ban finally give way.
    const overdue = window
      .map((c, i) => ({ c, i, skips: skips.get(c.origin) ?? 0 }))
      .filter((x) => x.skips >= FORCE_AFTER)
      .sort((x, y) => y.skips - x.skips);

    const forced = overdue.find((x) => neighbours.every((n) => !areTwins(x.c, n))) ?? overdue[0];
    if (forced) {
      window.forEach((c, i) => {
        if (i !== forced.i) skips.set(c.origin, (skips.get(c.origin) ?? 0) + 1);
      });
      out.push(pool.splice(forced.i, 1)[0]);
      continue;
    }

    // Four tiers, tried in order, and WHAT GETS GIVEN UP FIRST is the design.
    //
    // Everything relaxes under pressure except the twin ban, which is last to
    // go. Two versions ago the shape rule fell straight back to "anything" when
    // it could not be met, and two frames of the same picture ended up side by
    // side in the preview — the exact fault this is here to prevent. Giving up
    // a little colour, or a little variety, is a smaller loss than that.
    const ok = (cand, colour, shape, twins) =>
      neighbours.every((n) =>
        // Two colour tests, and warm-to-cold is checked on its own. The
        // composite also carries brightness and red, so it can be satisfied by
        // a pair that still changes temperature — which is the one thing this
        // must not allow.
        (!colour || (Math.abs(cand.b - n.b) <= MAX_HUE_JUMP && distance(cand, n) <= MAX_GRID_JUMP)) &&
        (!shape || layoutDistance(cand, n) >= MIN_SHAPE_IN_GRID) &&
        (!twins || !areTwins(cand, n)));

    const choices =
      window.filter((c) => ok(c, true, true, true)).length  ? window.filter((c) => ok(c, true, true, true))
      : window.filter((c) => ok(c, true, false, true)).length ? window.filter((c) => ok(c, true, false, true))
      : window.filter((c) => ok(c, false, false, true)).length ? window.filter((c) => ok(c, false, false, true))
      : window;

    let bestAt = 0, bestScore = -Infinity;
    choices.forEach((cand) => {
      const i = window.indexOf(cand);
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
  return out.slice(keep);
}

/**
 * Fill each post out to `slides` photos.
 *
 * A carousel has one job: the cover earns the tap, the rest reward it. So the
 * supporting photos are close to the cover in colour — the swipe must not
 * break the palette either — but rewarded for differing in light, because four
 * near-identical sunsets is a boring swipe and reads as padding.
 */
/**
 * @param photos      every photo that may appear as a SLIDE — the whole library.
 * @param covers      the subset still eligible to be a COVER. Covers are used
 *                    once and for ever, so on a replan this is the library
 *                    minus everything already posted or queued. Slides carry no
 *                    such rule, which is why the two lists are separate.
 * @param placed      the tail of the grid, oldest first, so a replan resumes
 *                    from the colour that is already showing.
 * @param startIndex  the first post number to hand out. Posting order is by
 *                    plan_index, so a replan must carry on counting or its
 *                    posts sort in front of the ones already waiting.
 */
export function buildCarousels(photos, {
  slides = 4, covers: coverPool = null, placed = [], startIndex = 0,
} = {}) {
  const covers = orderCovers(coverPool ?? photos, { placed });
  const lastUsed = new Map();   // origin -> index of the post that last used it
  const out = [];

  covers.forEach((cover, index) => {
    const near = photos.filter((p) => p.origin !== cover.origin);

    // Build at the full shape floor, and only bend it if the post would come
    // out too short to be a carousel at all.
    //
    // Measured over the real library: at the strict floor 67 of 78 posts fill
    // to four and no two slides anywhere are closer than 1.05 in shape. Bending
    // all the way to 0.45 buys ten more full posts but lets 0.70 pairs through
    // — two photos that read as the same picture. Three genuinely different
    // photos beat four where two of them repeat, so strict wins and the short
    // posts stay short. The bend below exists only so a cover at the very end
    // of the colour line, with almost no palette neighbours, still goes out as
    // a carousel instead of a lone photo.
    let chain = [cover];
    let used = new Set([cover.origin]);
    for (const [floor, wall] of [[MIN_SHAPE_IN_POST, MAX_SLIDE_DISTANCE], [0.85, MAX_SLIDE_DISTANCE], [0.65, MAX_SLIDE_DISTANCE + 8]]) {
      ({ chain, used } = fillPost({ cover, near, slides, floor, wall, index, lastUsed }));
      if (chain.length >= Math.min(3, slides)) break;
    }

    for (const p of chain) lastUsed.set(p.origin, index);

    out.push({
      cover,
      slides: chain,
      warmth: cover.b,
      family: family(cover),
      index: startIndex + index,
    });
  });

  return out;
}

/** One post's slides at a given shape floor. Pulled out so the floor can be retried. */
function fillPost({ cover, near, slides, floor, wall, index, lastUsed }) {
  const chain = [cover];
  const used = new Set([cover.origin]);

  while (chain.length < slides) {
      // A candidate has to be a genuinely different picture from EVERY slide
      // already in the post, not just from the last one. Checking only the
      // previous slide lets slide 4 repeat slide 2.
      // The palette wall holds between EVERY pair, not only against the cover:
      // two slides can each sit 18 from the cover and 36 from each other, which
      // is a visible break mid-swipe. The twin ban never relaxes at all.
      const fits = near.filter((p) =>
        !used.has(p.origin) &&
        chain.every((c) =>
          distance(c, p) <= wall &&
          !areTwins(c, p) &&
          layoutDistance(c, p) >= floor));

      if (!fits.length) break;   // rather post three good slides than a near-repeat

      let best = null, bestScore = -Infinity;
      for (const p of fits) {
        // Most different from what is already in the post wins. Colour is not
        // optimised here at all — the wall around the cover already guarantees
        // the palette, so spending the choice on colour again only buys
        // duplicates.
        const shape = Math.min(...chain.map((c) => layoutDistance(c, p)));
        const rested = index - (lastUsed.get(p.origin) ?? -Infinity) >= SLIDE_COOLDOWN;
        const score = shape * 10 + (rested ? 3 : 0);
        if (score > bestScore) { bestScore = score; best = p; }
      }
      chain.push(best);
      used.add(best.origin);
  }
  return { chain, used };
}

/**
 * What is already on the grid, or on its way there.
 *
 * Kept pure — it takes the two lists rather than reading the ledger — so the
 * tests can drive it without a filesystem.
 *
 * @param posted  feed posts that went out, ANY order (sorted here by time).
 * @param queued  feed posts built and waiting, ANY order (sorted by plan_index).
 * @returns spent      cover origins that must never be a cover again.
 *          tail       the last `perRow` cover origins, oldest first — the
 *                     squares a new post will physically touch.
 *          startIndex the next post number to hand out.
 */
export function gridState({ posted = [], queued = [], perRow = 3 } = {}) {
  const coverOf = (p) => p.plan_cover ?? p.origin;

  // Posts leave the queue in plan_index order, so the grid reads: everything
  // already out (oldest first), then everything still waiting (in plan order).
  const sequence = [
    ...[...posted].sort((a, b) => String(a.at).localeCompare(String(b.at))),
    ...[...queued].sort((a, b) => (a.plan_index ?? 0) - (b.plan_index ?? 0)),
  ];

  const indices = sequence.map((p) => p.plan_index).filter((n) => Number.isFinite(n));

  return {
    spent: new Set(sequence.map(coverOf).filter(Boolean)),
    tail: sequence.slice(-perRow).map(coverOf).filter(Boolean),
    startIndex: indices.length ? Math.max(...indices) + 1 : 0,
  };
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
  let worst = 0, where = null, worstHue = 0, whereHue = null;
  for (let i = 1; i < list.length; i++) {
    for (const back of [1, perRow]) {
      if (i - back < 0) continue;
      const a = list[i - back].cover, b = list[i].cover;
      const d = distance(a, b);
      if (d > worst) { worst = d; where = `${a.origin} -> ${b.origin}`; }

      // Reported separately, because the two are not the same complaint.
      // The composite above also counts brightness and red, so a dark frame
      // beside a bright one at the SAME hue scores high — and that reads as
      // rhythm, not as a clash. Warm-next-to-cold is the actual fault, and this
      // is the number that measures only that.
      const hue = Math.abs(a.b - b.b);
      if (hue > worstHue) { worstHue = hue; whereHue = `${a.origin} -> ${b.origin}`; }
    }
  }
  // The distribution says more than the maximum does. One 15-point step out of
  // 152 pairs is not a feed that jumps around; a median of 15 would be.
  const hues = [];
  for (let i = 1; i < list.length; i++) {
    for (const back of [1, perRow]) {
      if (i - back >= 0) hues.push(Math.abs(list[i].cover.b - list[i - back].cover.b));
    }
  }
  hues.sort((x, y) => x - y);
  const at = (q) => (hues.length ? hues[Math.floor(q * (hues.length - 1))] : 0);

  return {
    worst, where, worstHue, whereHue,
    pairs: hues.length,
    medianHue: at(0.5),
    p90Hue: at(0.9),
  };
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
