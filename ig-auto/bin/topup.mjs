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
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  config, brand, ensureDirs, listQueue, newId, originsOnCooldown,
  postedHashes, publicDir, recentPosts, sha256, withLock, writeItem, kindOf,
} from "../lib/queue.mjs";
import { generateAI, normalise, pickFromLibrary } from "../lib/image.mjs";
import { pickAngle, render, writeCaption } from "../lib/caption.mjs";
import { alert, inbox } from "../lib/notify.mjs";

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
    const buf = await normalise(picked.buf, kind);
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
        const item = await buildOne({ hashes, cooldown, context: varietyContext(kind), kind });
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
