#!/usr/bin/env node
// topup.mjs — keep the queue full.
//
// This is the half that is allowed to fail. It runs every day and tops the
// queue back up to config.queue_target (12 days of posts). Because the poster
// only ever reads from that queue, generation can break for a week and the
// feed keeps going out on time. That is the whole reliability trick: the thing
// that must not fail is trivial, and the thing that can fail has a deep buffer
// in front of it.
//
// Images are written into the site's public ig/ folder and committed here,
// days before they are needed. By posting time GitHub Pages has long since
// deployed them, so the URL Instagram fetches is guaranteed to be live.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  config, brand, ensureDirs, listQueue, newId, originsOnCooldown,
  postedHashes, publicDir, recentPosts, sha256, withLock, writeItem,
} from "../lib/queue.mjs";
import { generateAI, normalise, pickFromLibrary } from "../lib/image.mjs";
import { pickAngle, render, writeCaption } from "../lib/caption.mjs";
import { alert, inbox } from "../lib/notify.mjs";

// Pollinations' free tier is serial, and every item costs a caption call, so
// each run adds at most a handful and the next day's run finishes the job.
const MAX_PER_RUN = Number(process.env.IG_MAX_PER_RUN ?? 6);

/** Variety is judged against what is already queued as well as what went out. */
function varietyContext() {
  const queued = listQueue()
    .map((i) => ({ angle: i.angle, hashtags: i.hashtags, caption: i.caption }))
    .reverse();
  return [...queued, ...recentPosts(config.caption_similarity_window)];
}

async function buildOne({ hashes, cooldown, context }) {
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
    if (!picked && angle.ai_prompt) {
      try {
        picked = await generateAI(angle);
      } catch (err) {
        console.warn(`generate failed for angle ${angle.key}: ${err.message}`);
        continue;
      }
    }
    if (!picked) continue; // library-only angle with nothing left to give

    const buf = await normalise(picked.buf);
    const hash = sha256(buf);
    if (hashes.has(hash)) continue; // already published this exact picture
    hashes.add(hash);

    const id = newId();
    const file = `${id}.jpg`;
    const path = join(publicDir, file);
    writeFileSync(path, buf);

    // The picture exists before the words do, so the words can describe it.
    const caption = writeCaption({ imagePath: path, angleHint: angle, recent: context });
    const item = {
      id,
      created: new Date().toISOString(),
      source: picked.source,
      origin: picked.origin,
      angle: caption.angle,
      image: `${config.public_dir}/${file}`,
      url: `${config.public_base}/${file}`,
      caption: caption.text,
      hashtags: caption.hashtags,
      rendered_caption: render(caption),
      writer: caption.writer,
      sha256: hash,
    };
    writeItem(item);
    if (picked.origin) cooldown.add(picked.origin);
    return item;
  }
  return null;
}

async function main() {
  ensureDirs();

  const have = listQueue().length;
  const need = Math.min(MAX_PER_RUN, config.queue_target - have);
  if (need <= 0) {
    console.log(`queue has ${have}/${config.queue_target} items — nothing to do`);
    return;
  }
  console.log(`queue has ${have}/${config.queue_target} — building ${need}`);

  const hashes = postedHashes();
  const cooldown = originsOnCooldown();
  const built = [];

  for (let i = 0; i < need; i++) {
    try {
      const item = await buildOne({ hashes, cooldown, context: varietyContext() });
      if (!item) { console.warn("could not build an item — no usable angle left"); break; }
      built.push(item);
      console.log(`+ ${item.id} [${item.angle}] ${item.source} ${item.origin}`);
    } catch (err) {
      console.warn(`build ${i + 1}/${need} failed: ${err.message}`);
    }
  }

  const total = listQueue().length;
  console.log(`BUILT=${built.length}`);
  console.log(`QUEUE=${total}`);

  if (total <= config.queue_low_alert) {
    await alert(
      "CHIFBAY Instagram queue is low",
      `Only ${total} post(s) left in the queue and top-up could only add ${built.length}. ` +
      `The feed keeps posting until it runs dry.`,
    );
  } else if (built.length) {
    await inbox(
      "Chifbay Instagram queue topped up",
      `${built.length} new post(s) queued (${total} waiting). Review or edit them in the repo under ig-auto/queue/.`,
    );
  }
}

await withLock(main);
