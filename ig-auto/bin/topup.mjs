#!/usr/bin/env node
// topup.mjs — keep the queues full.
//
// This is the half that is allowed to fail. It runs every day and tops both
// queues back up: 12 feed posts and 10 stories. Because the posters only ever
// read from those queues, generation can break for a week and the account keeps
// going out on time. That is the whole reliability trick: the thing that must
// not fail is trivial, and the thing that can fail has a deep buffer in front.
//
// Images are written into the site's public ig/ folder and committed here, days
// before they are needed. By posting time GitHub Pages has long since deployed
// them, so the URL Instagram fetches is guaranteed to be live.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  config, brand, ensureDirs, listQueue, newId, originsOnCooldown,
  postedHashes, publicDir, recentPosts, ROOT, sha256, SITE_ROOT, withLock,
  writeItem, kindOf,
} from "../lib/queue.mjs";
import { generateAI, normalise, pickFromLibrary } from "../lib/image.mjs";
import { applyGrade } from "../lib/grade.mjs";
import { pickAngle, render, writeCaption } from "../lib/caption.mjs";
import { alert, inbox } from "../lib/notify.mjs";

/** The grid plan, if one has been built. Missing is a normal state, not a fault. */
function readPlan() {
  try {
    const plan = JSON.parse(readFileSync(join(ROOT, "feed-plan.json"), "utf8"));
    return plan?.posts?.length ? plan : null;
  } catch {
    return null;
  }
}

// Pollinations' free tier is serial, and every feed item costs a caption call,
// so each run adds at most a handful and the next day's run finishes the job.
const MAX_PER_RUN = Number(process.env.IG_MAX_PER_RUN ?? 6);

const PLAN = [
  { kind: "feed", target: config.queue_target, low: config.queue_low_alert },
  { kind: "story", target: config.story_queue_target, low: config.story_queue_low_alert },
];

/** Variety is judged against what is already queued as well as what went out. */
function varietyContext(kind) {
  const queued = listQueue(kind)
    .map((i) => ({ angle: i.angle, hashtags: i.hashtags, caption: i.caption }))
    .reverse();
  const posted = recentPosts(60).filter((p) => kindOf(p) === kind);
  return [...queued, ...posted].slice(0, config.caption_similarity_window);
}

/**
 * Build one feed post from the grid plan: a carousel whose cover is the photo
 * the plan put at this position, and whose other slides share its palette.
 *
 * The plan is the authority on WHICH photos and in WHAT order. This only turns
 * its decision into files. If there is no plan, or the plan is used up, the
 * caller falls back to the old one-photo path so a missing plan can never stop
 * the account posting.
 */
async function buildPlanned({ hashes, cooldown, context }) {
  const plan = readPlan();
  if (!plan) return null;

  // A cover is spent by a feed post AND by a story. A story is the whole
  // picture, not a supporting slide, so serving it again as the face of a
  // carousel a few days later is the repeat a viewer actually notices.
  // 005-1J0OAZtR.png was queued as both on 3 September, which is how this was
  // found. Supporting slides stay reusable; that is what makes 38 photos into
  // 38 posts instead of 10.
  const done = new Set([
    ...listQueue("feed").map((i) => i.plan_cover),
    ...listQueue("feed").map((i) => i.origin),
    ...listQueue("story").map((i) => i.origin),
    ...recentPosts(400)
      .filter((p) => kindOf(p) === "feed" || kindOf(p) === "story")
      .flatMap((p) => [p.plan_cover, p.origin]),
  ].filter(Boolean));

  // Only "has this cover already been used as a cover" may skip a post.
  //
  // Consulting the general photo cooldown here was wrong and skipped plan
  // entries 2 and 4 outright: their covers had appeared as supporting SLIDES in
  // posts 0 and 1, which put them on cooldown. Slides are meant to be reusable
  // — that is the whole reason 78 photos make 78 posts instead of 20 — and
  // skipping plan entries also puts holes in an order that was chosen so the
  // grid reads correctly.
  const next = plan.posts.find((p) => !done.has(p.cover));
  if (!next) return null;

  const id = newId();
  const slides = [];
  for (const [i, origin] of next.slides.entries()) {
    const abs = join(SITE_ROOT, origin);
    if (!existsSync(abs)) { console.warn(`plan slide missing on disk: ${origin}`); continue; }
    // Graded first, then cropped. Grading measures the whole picture, so doing
    // it after a 4:5 crop would read a different photo from the one the plan
    // measured, and the grid would drift away from the preview.
    const buf = await normalise(await applyGrade(abs), "feed");
    const file = `${id}-${i + 1}.jpg`;
    writeFileSync(join(publicDir, file), buf);
    slides.push({
      origin,
      image: `${config.public_dir}/${file}`,
      url: `${config.public_base}/${file}`,
      sha256: sha256(buf),
    });
  }
  if (slides.length < 2) return null;   // not a carousel; let the old path handle it

  const caption = writeCaption({
    imagePath: join(publicDir, slides[0].image.split("/").pop()),
    angleHint: pickAngle(context),
    recent: context,
    source: "library",
  });

  const item = {
    id,
    kind: "feed",
    created: new Date().toISOString(),
    source: "library",
    // The cover doubles as the item's identity everywhere else in the codebase
    // — dedupe, cooldown and the ledger all read these top-level fields.
    origin: slides[0].origin,
    image: slides[0].image,
    url: slides[0].url,
    sha256: slides[0].sha256,
    slides,
    plan_index: next.plan_index,
    plan_cover: next.cover,
    palette: next.family,
    angle: caption.angle,
    caption: caption.text,
    hashtags: caption.hashtags,
    rendered_caption: render(caption),
    writer: caption.writer,
  };
  writeItem(item);
  for (const s of slides) { hashes.add(s.sha256); cooldown.add(s.origin); }
  return item;
}

async function buildOne({ hashes, cooldown, context, kind }) {
  // Try angles in preference order. An angle whose subject is the boat, the
  // crew or the guests can only be served from real photos, so if the library
  // is exhausted we move to an angle the generator is allowed to cover.
  const ordered = [pickAngle(context), ...brand.angles];

  for (const angle of ordered) {
    const wantLibrary =
      !angle.ai_prompt || Math.random() < config.image_source_mix.library;

    let picked = null;
    if (wantLibrary) {
      picked = pickFromLibrary({ excludeOrigins: cooldown, excludeHashes: hashes });
    }
    if (!picked && angle.ai_prompt && config.image_source_mix.ai > 0) {
      try {
        picked = await generateAI(angle);
      } catch (err) {
        console.warn(`generate failed for angle ${angle.key}: ${err.message}`);
        continue;
      }
    }
    if (!picked) continue; // library-only angle with nothing left to give

    // Feed is 4:5, story is 9:16 — different crops of the same library.
    // Graded first, then cropped, so the house look is measured from the whole
    // picture. Stories never appear in the grid, but they are the same brand on
    // the same day and looking like a different account would be odd.
    const buf = await normalise(await applyGrade(picked.buf), kind);
    const hash = sha256(buf);
    if (hashes.has(hash)) continue; // already published this exact picture
    hashes.add(hash);

    const id = newId();
    const file = `${id}.jpg`;
    const path = join(publicDir, file);
    writeFileSync(path, buf);

    // Stories carry no caption: the API cannot attach text, stickers or links,
    // so writing one would be thrown away. The angle still comes from the hint
    // because it only drives ordering variety here, never published words.
    const caption = kind === "feed"
      ? writeCaption({ imagePath: path, angleHint: angle, recent: context, source: picked.source })
      : null;

    const item = {
      id,
      kind,
      created: new Date().toISOString(),
      source: picked.source,
      origin: picked.origin,
      angle: caption ? caption.angle : angle.key,
      image: `${config.public_dir}/${file}`,
      url: `${config.public_base}/${file}`,
      sha256: hash,
      ...(caption
        ? {
            caption: caption.text,
            hashtags: caption.hashtags,
            rendered_caption: render(caption),
            writer: caption.writer,
          }
        : {}),
    };
    writeItem(item);
    if (picked.origin) cooldown.add(picked.origin);
    return item;
  }
  return null;
}

async function main() {
  ensureDirs();

  const hashes = postedHashes();
  // Cooldown covers what has been posted AND what is already waiting, otherwise
  // the same photo gets used for a feed post and a story a few days apart.
  // A 9:16 crop has a different hash from the 4:5 one, so only the source path
  // catches this.
  const cooldown = originsOnCooldown();
  for (const queued of listQueue()) if (queued.origin) cooldown.add(queued.origin);
  const summary = [];
  const problems = [];

  for (const { kind, target, low } of PLAN) {
    const have = listQueue(kind).length;
    const need = Math.min(MAX_PER_RUN, target - have);
    if (need <= 0) {
      console.log(`${kind}: ${have}/${target} — nothing to do`);
      summary.push(`${kind} ${have}/${target}`);
      continue;
    }
    console.log(`${kind}: ${have}/${target} — building ${need}`);

    let built = 0;
    for (let i = 0; i < need; i++) {
      try {
        const context = varietyContext(kind);
        // Feed posts come from the grid plan. buildOne is the fallback for
        // stories, and for a feed whose plan is missing or used up.
        const item = (kind === "feed" && await buildPlanned({ hashes, cooldown, context }))
          || await buildOne({ hashes, cooldown, context, kind });
        if (!item) { console.warn(`${kind}: no usable angle left`); break; }
        built++;
        console.log(`+ ${kind} ${item.id} [${item.angle}] ${item.source} ${item.origin}`);
      } catch (err) {
        console.warn(`${kind} build ${i + 1}/${need} failed: ${err.message}`);
      }
    }

    const total = listQueue(kind).length;
    summary.push(`${kind} ${total}/${target} (+${built})`);
    if (total <= low) problems.push(`only ${total} ${kind} post(s) left`);
  }

  const built = summary.join(", ");
  console.log(`BUILT=${built}`);
  console.log(`QUEUE=${listQueue().length}`);

  if (problems.length) {
    await alert(
      "CHIFBAY Instagram queue is low",
      problems.join("\n") + "\n\nPosting continues until it runs dry.",
    );
  } else {
    await inbox("Chifbay Instagram queue topped up", built + "\n\nReview them in ig-auto/queue/.");
  }
}

await withLock(main);
