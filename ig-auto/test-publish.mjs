#!/usr/bin/env node
// test-publish.mjs — guards the two faults that stopped this account posting.
//
// Neither of them could be caught by reading the code, and neither showed up as
// a red run. They are exactly the kind of thing that comes back the next time
// someone edits publish.mjs, so they get a test:
//
//   1. Publishing before Meta has finished downloading the image.
//      Creating a container hands Meta a URL; Meta fetches it afterwards, on
//      its own servers. Publish too early and it fails with
//      "Media ID is not available" (9007 / 2207027). It is a race, so the code
//      looked correct and worked twice before failing every time after.
//
//   2. A failed post finishing green, because "node post.mjs | tee log" under
//      bash -e takes tee's exit code. The alert step is guarded by
//      if: failure(), so it never fired either.
//
// No network and no packages: fetch is replaced with a fake Meta that behaves
// the way the real one does. Run it with `node test-publish.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${err.message.split("\n")[0]}`);
  }
}

/**
 * A fake Meta. `readyAfter` is how many status polls it answers IN_PROGRESS
 * before it says FINISHED — that is the download the real API is doing.
 * media_publish refuses with the real 9007 until then, exactly as Meta does.
 */
function fakeMeta({ readyAfter = 1, containerFails = null, publishAlwaysEarly = false } = {}) {
  const calls = [];
  const bodies = [];
  let polls = 0;
  let containers = 0;
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? "GET";
    calls.push(`${method} ${path}`);
    const json = (body, status = 200) =>
      ({ ok: status < 400, status, json: async () => body });

    if (method === "POST" && path.endsWith("/media")) {
      if (containerFails) return json({ error: containerFails }, 400);
      const sent = JSON.parse(init.body);
      bodies.push(sent);
      // A carousel parent is assembled from children that are already done, so
      // it is ready immediately; a child still has to be downloaded.
      return json({ id: sent.media_type === "CAROUSEL" ? "PARENT" : `CONTAINER${++containers}` });
    }
    if (method === "GET" && path === "/v21.0/PARENT") return json({ status_code: "FINISHED" });
    if (method === "GET" && /^\/v21\.0\/CONTAINER\d+$/.test(path)) {
      polls++;
      return json({ status_code: polls > readyAfter ? "FINISHED" : "IN_PROGRESS" });
    }
    if (method === "POST" && path.endsWith("/media_publish")) {
      const early = publishAlwaysEarly || polls <= readyAfter;
      if (early) {
        return json({
          error: {
            message: "Media ID is not available",
            type: "OAuthException",
            code: 9007,
            error_subcode: 2207027,
            error_user_msg: "The media is not ready for publishing, please wait for a moment",
            fbtrace_id: "TRACE",
          },
        }, 400);
      }
      return json({ id: "MEDIA1" });
    }
    throw new Error(`unexpected call: ${method} ${path}`);
  };
  calls.bodies = bodies;
  return calls;
}

const item = { kind: "story", url: "https://www.chifbay.com/ig/x.jpg", rendered_caption: "hi" };

// Imported once, after fetch is first replaced, because the module is cached.
fakeMeta();
process.env.IG_ACCESS_TOKEN = "test-token";
process.env.IG_USER_ID = "1784100";
process.env.IG_TRANSPORT = "graph";
const { publish } = await import("./lib/publish.mjs");

// --- 1. the race ------------------------------------------------------------

await check("waits for the container before publishing", async () => {
  const calls = fakeMeta({ readyAfter: 2 });
  const out = await publish(item);
  assert.equal(out.media_id, "MEDIA1");
  const firstPublish = calls.indexOf("POST /v21.0/1784100/media_publish");
  const lastPoll = calls.lastIndexOf("GET /v21.0/CONTAINER1");
  assert.ok(lastPoll !== -1, "never polled the container status at all");
  assert.ok(
    lastPoll < firstPublish,
    `published before the container was ready — calls were ${calls.join(", ")}`,
  );
});

await check("polls until FINISHED rather than a fixed number of times", async () => {
  const calls = fakeMeta({ readyAfter: 4 });
  await publish(item);
  const polls = calls.filter((c) => c === "GET /v21.0/CONTAINER1").length;
  assert.ok(polls >= 5, `gave up after ${polls} polls`);
});

await check("retries the SAME container, never builds a second one", async () => {
  // FINISHED but publish still refuses once — Meta really does this.
  const calls = fakeMeta({ readyAfter: 0 });
  let first = true;
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/media_publish") && first) {
      first = false;
      return {
        ok: false, status: 400,
        json: async () => ({ error: { message: "Media ID is not available", code: 9007, error_subcode: 2207027 } }),
      };
    }
    return inner(url, init);
  };
  await publish(item);
  const containers = calls.filter((c) => c === "POST /v21.0/1784100/media").length;
  assert.equal(containers, 1, "built a second container — that is a second download and the same race");
});

// --- 2. errors say what is wrong --------------------------------------------

await check("an image Instagram refuses stops at once, with its reason", async () => {
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if ((init.method ?? "GET") === "POST") return { ok: true, status: 200, json: async () => ({ id: "CONTAINER1" }) };
    return { ok: true, status: 200, json: async () => ({ status_code: "ERROR", status: "media download failed" }) };
  };
  await assert.rejects(publish(item), /refused the image \(ERROR\).*media download failed/s);
});

await check("Meta's code and subcode reach the log", async () => {
  fakeMeta({ containerFails: { message: "API access blocked.", code: 190, error_subcode: 492, type: "OAuthException", fbtrace_id: "ABC" } });
  await assert.rejects(publish(item), (err) => {
    assert.match(err.message, /API access blocked\./);
    assert.match(err.message, /code 190/);
    assert.match(err.message, /subcode 492/);
    assert.match(err.message, /fbtrace ABC/);
    return true;
  });
});

// --- 3. carousels -----------------------------------------------------------

const carousel = {
  kind: "feed",
  rendered_caption: "four of them",
  url: "https://www.chifbay.com/ig/a-1.jpg",
  slides: [1, 2, 3, 4].map((n) => ({ url: `https://www.chifbay.com/ig/a-${n}.jpg` })),
};

await check("a carousel builds one child per photo, then a parent", async () => {
  const calls = fakeMeta({ readyAfter: 0 });
  const out = await publish(carousel);
  assert.equal(out.media_id, "MEDIA1");

  const children = calls.bodies.filter((b) => b.is_carousel_item);
  assert.equal(children.length, 4, "wrong number of child containers");
  assert.deepEqual(
    children.map((c) => c.image_url),
    carousel.slides.map((s) => s.url),
    "slides were reordered — the cover must stay first",
  );

  const parent = calls.bodies.find((b) => b.media_type === "CAROUSEL");
  assert.ok(parent, "no CAROUSEL parent container was created");
  assert.equal(parent.children.split(",").length, 4);
  assert.equal(parent.caption, "four of them", "the caption belongs on the parent");
});

await check("children carry no caption of their own", async () => {
  // Meta rejects a carousel whose children have captions — the caption belongs
  // on the parent and nowhere else.
  const calls = fakeMeta({ readyAfter: 0 });
  await publish(carousel);
  const children = calls.bodies.filter((b) => b.is_carousel_item);
  assert.equal(children.length, 4, "no children were built, so this proved nothing");
  for (const c of children) assert.equal(c.caption, undefined, "a child was given a caption");
});

await check("every child finishes downloading before the parent is built", async () => {
  const calls = fakeMeta({ readyAfter: 1 });
  await publish(carousel);

  // The parent is the last container POSTed; everything before it is a child
  // plus its status polls. Publishing a carousel whose children are still
  // downloading fails exactly like publishing a lone photo too early.
  const posts = [];
  calls.forEach((c, i) => { if (c === "POST /v21.0/1784100/media") posts.push(i); });
  assert.equal(posts.length, 5, "expected 4 children and 1 parent");

  const parentAt = posts[4];
  for (const childAt of posts.slice(0, 4)) {
    const polled = calls.slice(childAt, parentAt).some((c) => /^GET \/v21\.0\/CONTAINER\d+$/.test(c));
    assert.ok(polled, `child at call ${childAt} was never waited for`);
  }
  assert.ok(
    calls.indexOf("POST /v21.0/1784100/media_publish") > parentAt,
    "published before the parent existed",
  );
});

await check("more than 10 photos is refused before any call is made", async () => {
  fakeMeta();
  const tooMany = { ...carousel, slides: Array.from({ length: 11 }, (_, n) => ({ url: `u${n}` })) };
  await assert.rejects(publish(tooMany), /at most 10 photos, got 11/);
});

await check("an old single-photo item still posts unchanged", async () => {
  const calls = fakeMeta({ readyAfter: 0 });
  await publish({ kind: "feed", url: "https://www.chifbay.com/ig/old.jpg", rendered_caption: "x" });
  assert.equal(calls.bodies.filter((b) => b.is_carousel_item).length, 0);
  assert.equal(calls.bodies[0].image_url, "https://www.chifbay.com/ig/old.jpg");
  assert.equal(calls.bodies[0].caption, "x");
});

await check("a story is never turned into a carousel", async () => {
  const calls = fakeMeta({ readyAfter: 0 });
  await publish({ ...carousel, kind: "story" });
  assert.equal(calls.bodies.filter((b) => b.is_carousel_item).length, 0);
  assert.equal(calls.bodies[0].media_type, "STORIES");
  assert.equal(calls.bodies[0].caption, undefined, "a story takes no caption");
});

// --- 4. the grid plan -------------------------------------------------------

const { distance, layoutDistance } = await import("./lib/palette.mjs");
const { buildCarousels, worstJump, worstSwipe } = await import("./lib/feedplan.mjs");

/** Fake photos spread along the warm-cold line, in deliberately bad order. */
const fakePhotos = Array.from({ length: 40 }, (_, i) => ({
  origin: `p${i}.jpg`,
  L: 55, a: 5,
  b: ((i * 17) % 40) * 2 - 40,          // shuffled warmth, so sorting must do the work
  chroma: 20, brightness: 40 + (i % 5) * 8, contrast: 30,
  layout: Array.from({ length: 25 }, (_, k) => Math.sin(i * 1.7 + k)),
}));

await check("the grid never jumps: no neighbour pair clashes", () => {
  const plan = buildCarousels(fakePhotos, { slides: 4 });
  const { worst } = worstJump(plan);
  assert.ok(worst < 25, `worst neighbour jump is ${worst.toFixed(1)}, over the 25 limit`);
});

await check("no photo is stranded to the end and posted out of palette", () => {
  // The bug this catches: a photo that loses every comparison stays unplaced
  // until the feed has moved to the far side of the colour line, then has to go
  // somewhere. It showed up as a 94-point jump on the last post.
  const plan = buildCarousels(fakePhotos, { slides: 4 });
  const tail = plan.slice(-3).map((c) => c.warmth);
  const head = plan.slice(0, 3).map((c) => c.warmth);
  assert.ok(
    Math.max(...tail) < Math.min(...head),
    `the plan ends warmer than it starts (${tail} vs ${head}) — something was stranded`,
  );
});

await check("a swipe inside a post never breaks the palette", () => {
  const plan = buildCarousels(fakePhotos, { slides: 4 });
  const { worst } = worstSwipe(plan);
  assert.ok(worst < 25, `worst swipe is ${worst.toFixed(1)}`);
});

await check("every post is full and has no repeated photo", () => {
  const plan = buildCarousels(fakePhotos, { slides: 4 });
  for (const c of plan) {
    assert.equal(c.slides.length, 4, `${c.cover.origin} has ${c.slides.length} slides`);
    assert.equal(new Set(c.slides.map((s) => s.origin)).size, 4, "a photo appears twice in one post");
    assert.equal(c.slides[0].origin, c.cover.origin, "the cover must be the first slide");
  }
});

await check("every photo is the cover exactly once", () => {
  const plan = buildCarousels(fakePhotos, { slides: 4 });
  const covers = plan.map((c) => c.cover.origin);
  assert.equal(covers.length, fakePhotos.length);
  assert.equal(new Set(covers).size, fakePhotos.length, "a photo covers two posts");
});

await check("composition, not just colour, separates neighbours", () => {
  // Twelve photos with the same colour and only two distinct shapes. Colour
  // alone cannot order these; the plan must still alternate them.
  const shapeA = Array.from({ length: 25 }, (_, k) => (k < 12 ? 1 : -1));
  const shapeB = Array.from({ length: 25 }, (_, k) => (k % 2 ? 1 : -1));
  const twins = Array.from({ length: 12 }, (_, i) => ({
    origin: `t${i}.jpg`, L: 55, a: 5, b: 10 - i * 0.1,
    chroma: 20, brightness: 50, contrast: 30,
    layout: i % 2 ? shapeA : shapeB,
  }));
  const plan = buildCarousels(twins, { slides: 3 });
  let sameShapeInARow = 0;
  for (let i = 1; i < plan.length; i++) {
    if (layoutDistance(plan[i].cover, plan[i - 1].cover) < 0.3) sameShapeInARow++;
  }
  assert.ok(sameShapeInARow <= 2, `${sameShapeInARow} neighbouring pairs are the same composition`);
});

await check("grading a photo never washes it out or blows it up", async () => {
  const { gradeFor, LOOK } = await import("./lib/grade.mjs");
  for (const m of [
    { brightness: 5, chroma: 90 },     // near-black, wildly saturated
    { brightness: 99, chroma: 1 },     // blown out, grey
    { brightness: 56, chroma: 20 },    // already on target
  ]) {
    const g = gradeFor(m);
    assert.ok(g.brightness >= 1 - LOOK.maxBrightnessShift && g.brightness <= 1 + LOOK.maxBrightnessShift,
      `brightness ${g.brightness} escaped the clamp`);
    assert.ok(g.saturation >= LOOK.minSaturation && g.saturation <= 1,
      `saturation ${g.saturation} escaped the clamp`);
  }
  assert.equal(gradeFor({ brightness: 56, chroma: 20 }).saturation, 1,
    "a photo already inside the ceiling must not be desaturated at all");
});

// --- 5. a failed post must fail the run -------------------------------------

await check("every workflow that pipes runs under pipefail", () => {
  // Without this, a failed post finishes green and the if: failure() alert
  // never fires. `shell: bash` is what makes Actions use -eo pipefail.
  for (const wf of ["post", "story", "heartbeat", "token-check", "topup", "whoami"]) {
    let text;
    try {
      text = readFileSync(new URL(`../.github/workflows/ig-auto-${wf}.yml`, import.meta.url), "utf8");
    } catch {
      continue; // that workflow does not exist, nothing to guard
    }
    if (!/\|\s*tee\b|\|\s*grep\b/.test(text)) continue;
    assert.match(
      text,
      /defaults:\s*\n\s*run:\s*\n\s*shell:\s*bash/,
      `ig-auto-${wf}.yml pipes but has no "defaults: run: shell: bash" — a failed post would go green`,
    );
  }
});

// ----------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} FAILED, ${passed} passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${passed} checks passed`);
