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
import { assertImageIsLive, findRecentPost, publish, slideUrls, verifyMedia } from "../lib/publish.mjs";
import { alert, inbox } from "../lib/notify.mjs";
import { dueApproved, readApprovals } from "../lib/approval.mjs";
import { pickFeed, postedIds, readControls, readReelPlan, slotFor } from "../lib/autopilot.mjs";
import { writeManifest } from "../lib/manifest.mjs";

// IG_TEST_FAST is for test-auto.mjs only: same code path, no real waiting.
const sleep = (ms) => new Promise((r) => setTimeout(r, process.env.IG_TEST_FAST === "1" ? 1 : ms));

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
  // Photos nobody has seen and Reels go before the colour plan: a new photo in
  // the Drive folder should reach the account in days, not after the plan.
  const urgent = queue.filter((i) => i.priority === 0);
  if (urgent.length) return urgent.sort((a, b) => a.created.localeCompare(b.created))[0];

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
  let item;
  if (config.require_approval !== false) {
    // The old gated mode: only items Theo approved, on their day.
    if (!queue.length) throw new Error(`${KIND} queue is empty — nothing to post`);
    let approvals;
    try {
      approvals = await readApprovals();
    } catch (err) {
      console.log(`not posting: the approval list could not be read (${err.message})`);
      console.log("POSTED=false");
      return;
    }
    const due = dueApproved(queue, approvals);
    if (!due.length) {
      console.log(`no approved ${KIND} is due today (${queue.length} waiting for approval)`);
      console.log("POSTED=false");
      return;
    }
    item = due[0];
  } else {
    // Autonomous since the audit of 2 Oct 2026: pause and vetoes, then the week.
    let ctl;
    try {
      ctl = await readControls();
    } catch (err) {
      // Fails closed. Says so loudly, because a silent stop looks like a quiet day.
      await alert(`CHIFBAY Instagram ${KIND} held`, `The pause and veto list could not be read (${err.message}), so nothing was posted.`);
      console.log(`not posting: pause and vetoes unreadable (${err.message})`);
      console.log("POSTED=false");
      return;
    }
    if (ctl.paused) {
      console.log(`not posting: PAUSED (${ctl.reason || "no reason given"})`);
      console.log("POSTED=false");
      return;
    }
    const posted = postedIds();
    if (KIND === "story") {
      item = chooseNext(queue.filter((i) => !ctl.skipped.has(i.id) && !posted.has(i.id)));
      if (!item) {
        await alert("CHIFBAY Instagram story queue is EMPTY", "No story qualified today. Run the top-up workflow.");
        console.log("POSTED=false");
        return;
      }
    } else {
      const pick = pickFeed({ plan: readReelPlan(), queue, ctl, posted, chooseQueued: chooseNext });
      if (!pick.item) {
        console.log(`not posting: ${pick.why}`);
        if (slotFor() !== "rest") {
          await alert("CHIFBAY Instagram: nothing qualified", `${pick.why}. No filler was posted. Add footage or run the top-up.`);
        }
        console.log("POSTED=false");
        return;
      }
      item = pick.item;
      if (pick.stand_in) console.log(`no qualified ${pick.slot} today, a qualified ${item.media === "video" ? "Reel" : "carousel"} stands in`);
    }
  }
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
      if (item.cover_url) await assertImageIsLive(item.cover_url);
    }

    // Published once, never twice: before every retry, ask Instagram whether
    // the last attempt went out after all (a timeout can hide a success).
    const startedAt = Date.now();
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await publish(item);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`publish attempt ${attempt} failed: ${err.message}`);
        const already = await findRecentPost(item, startedAt).catch(() => null);
        if (already) {
          console.warn(`it went out anyway as ${already}: not retrying`);
          result = { transport: "graph", media_id: already, confirmed: true, recovered: true };
          break;
        }
        if (/code 190\b|OAuthException|token/i.test(err.message)) break; // a dead token does not heal in a minute
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

  // Read it back: the permalink is the proof the post exists.
  try {
    const seen = result.media_id ? await verifyMedia(result.media_id) : null;
    if (seen) Object.assign(result, seen);
  } catch (err) {
    result.unverified = String(err.message ?? err);
    await alert(`CHIFBAY Instagram ${KIND} posted but not verified`, `${item.id} as ${result.media_id}: ${result.unverified}`);
  }

  // A Reel lives in reels-plan.json, not in queue/: the ledger is its record.
  if (item.source !== "reel") markPosted(item, result);
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
    media: item.media ?? "photo",
    cover_url: item.cover_url,
    slides: (item.slides ?? []).map((s) => s.origin).filter(Boolean),
    ...result,
  });
  saveState({ [lastPostKey(KIND)]: today() });
  writeManifest();

  console.log(`POSTED=true`);
  console.log(`MEDIA_ID=${result.media_id ?? ""}`);
  if (!result.confirmed) {
    console.warn("transport did not confirm a media id — check the account by hand");
  }
  await inbox(
    `Chifbay posted a ${KIND === "story" ? "story" : item.media === "video" ? "Reel" : "photo"} to Instagram`,
    `${item.angle} · ${listQueue(KIND).length} left in the ${KIND} queue` +
      (KIND === "feed" ? `\n\n${item.caption.slice(0, 220)}` : ""),
  );
}

await withLock(main);
