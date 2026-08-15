#!/usr/bin/env node
// post.mjs — the half that must not fail.
//
// It does as little as possible on purpose: take the oldest queue item, check
// its image is really live, hand it to the transport, move it to posted/. No
// generation, no network calls to AI providers, nothing that can be slow or
// refuse. If this runs and the queue has anything in it, a post goes out.
//
// Posts a feed photo by default, or a story with IG_KIND=story. The two are
// guarded and queued separately, so one of each goes out per day rather than
// one in total, and a story failing never costs you the feed post.
//
// Timing note: the workflow fires at a fixed hour, then this waits a random
// number of minutes before publishing. Posting at exactly 09:00:00 every single
// day is the most obviously automated thing an account can do; a drifting time
// inside a sensible window costs nothing and looks like a person.
import {
  alreadyPostedToday, appendLedger, config, ensureDirs, kindOf, lastPostKey,
  listQueue, markPosted, recentPosts, saveState, today, withLock,
} from "../lib/queue.mjs";
import { assertImageIsLive, publish, slideUrls } from "../lib/publish.mjs";
import { alert, inbox } from "../lib/notify.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KIND = process.env.IG_KIND === "story" ? "story" : "feed";

async function jitter() {
  if (process.env.IG_NO_JITTER === "1") return;
  const minutes = Math.floor(Math.random() * (config.post_jitter_minutes + 1));
  console.log(`waiting ${minutes} min so the posting time is not identical every day`);
  await sleep(minutes * 60_000);
}

/**
 * "Not connected yet" is a normal state between deploying this and finishing
 * the Meta setup, not a fault. Returns a reason to skip, or null to go ahead.
 * Without this the job would fail and alert every single morning until setup
 * was done, which trains you to ignore the alerts that matter.
 */
function notConfigured() {
  const transport = process.env.IG_TRANSPORT || config.transport;
  if (transport === "graph" && !process.env.IG_ACCESS_TOKEN) {
    return "IG_ACCESS_TOKEN is not set — finish the Meta setup in ig-auto/README.md";
  }
  if (transport === "graph" && !(process.env.IG_USER_ID || config.ig_user_id)) {
    return "no Instagram account id yet — run the whoami workflow";
  }
  if (transport === "make-webhook" && !process.env.MAKE_IG_WEBHOOK) {
    return "MAKE_IG_WEBHOOK is not set";
  }
  return null;
}

/**
 * Which item goes out next.
 *
 * Feed items carry a `plan_index` from the grid plan, and that order is the
 * whole point of the plan: it is what makes this post sit well next to the two
 * beside it and the one above it. Nothing here may second-guess it.
 *
 * The old rule here skipped past an angle used in the last two posts, to break
 * up runs of sunsets. The plan now decides that with the actual colour and
 * composition of the pictures, so keeping the old rule would only corrupt a
 * considered order. Stories have no grid, so they stay oldest-first with the
 * angle-variety rule.
 */
function chooseNext(queue) {
  const planned = queue.filter((i) => Number.isFinite(i.plan_index));
  if (planned.length) {
    return planned.sort((a, b) => a.plan_index - b.plan_index)[0];
  }

  const lastAngles = recentPosts(40)
    .filter((p) => kindOf(p) === KIND)
    .slice(0, 2)
    .map((p) => p.angle);
  return queue.find((i) => !lastAngles.includes(i.angle)) ?? queue[0];
}

async function main() {
  ensureDirs();

  const blocked = notConfigured();
  if (blocked) {
    console.log(`not posting: ${blocked}`);
    console.log("POSTED=false");
    return;
  }

  // The daily guard, not a nicety: GitHub can re-run a workflow, and a manual
  // trigger on a day that already posted must be a no-op, never a second post.
  if (alreadyPostedToday(KIND)) {
    console.log(`${KIND} already posted today (${today()}) — nothing to do`);
    console.log("POSTED=false");
    return;
  }

  const queue = listQueue(KIND);
  if (!queue.length) {
    await alert(
      `CHIFBAY Instagram ${KIND} queue is EMPTY`,
      `Nothing was posted today because the ${KIND} queue ran dry. Run the top-up workflow.`,
    );
    throw new Error(`${KIND} queue is empty — nothing to post`);
  }

  const item = chooseNext(queue);
  console.log(`posting ${KIND} ${item.id} [${item.angle}] from ${item.origin}`);

  // Everything that can go wrong from here is handled the same way, because
  // from the outside there is no difference between "Instagram refused it" and
  // "the image URL was dead" — both mean no post today, and both need to be in
  // the ledger and on your phone rather than only in a CI log.
  let result;
  try {
    // Jitter first, then check the image — the wait doubles as extra time for a
    // very recently queued image to finish deploying to Pages.
    await jitter();
    // A dry run is for checking wiring locally, before the image has ever been
    // pushed, so the liveness check would always fail and prove nothing.
    if ((process.env.IG_TRANSPORT || config.transport) !== "dry-run") {
      // Every slide, not just the cover. Meta builds a carousel child by child
      // and gives up on the whole post if one URL is dead, so finding that here
      // costs one HEAD request and saves the post.
      for (const url of slideUrls(item)) await assertImageIsLive(url);
    }

    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await publish(item);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`publish attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await sleep(60_000 * attempt);
      }
    }
    if (!result) throw lastErr;
  } catch (err) {
    // The item stays in the queue on purpose — tomorrow's run picks it up again.
    const why = String(err?.message ?? err);
    appendLedger({ ok: false, kind: KIND, id: item.id, error: why });
    await alert(
      `CHIFBAY Instagram ${KIND} FAILED`,
      `${item.id}: ${why}\n\nIt is still in the queue and tomorrow's run will retry it.`,
    );
    throw err;
  }

  markPosted(item, result);
  appendLedger({
    ok: true,
    kind: KIND,
    id: item.id,
    sha256: item.sha256,
    origin: item.origin,
    source: item.source,
    angle: item.angle,
    hashtags: item.hashtags,
    caption: item.caption,
    url: item.url,
    plan_cover: item.plan_cover,
    plan_index: item.plan_index,
    ...result,
  });
  saveState({ [lastPostKey(KIND)]: today() });

  console.log(`POSTED=true`);
  console.log(`MEDIA_ID=${result.media_id ?? ""}`);
  if (!result.confirmed) {
    console.warn("transport did not confirm a media id — check the account by hand");
  }
  await inbox(
    `Chifbay posted a ${KIND === "story" ? "story" : "photo"} to Instagram`,
    `${item.angle} · ${listQueue(KIND).length} left in the ${KIND} queue` +
      (KIND === "feed" ? `\n\n${item.caption.slice(0, 220)}` : ""),
  );
}

await withLock(main);
