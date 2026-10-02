// autopilot.mjs: what the robot posts when nobody approves each post.
//
// Since the audit of 2 Oct 2026 the account runs on its own. A post goes out
// when it passed its checks; Theo can still veto one ("skipped" on the portal
// or the board), pin one to a day ("approved"), or stop everything with the
// emergency pause. Both come from one call to the portal (the approvals
// answer), and nothing posts when that call fails: a missed day is cheap, a
// post after "stop" is not.
//
// The week (Madeira time) decides the kind of feed post:
//   reel days      the next Reel from reels-plan.json whose checks passed
//   carousel days  the next carousel in the queue (curated sets first)
//   rest           nothing
// When the planned kind has nothing qualified, the other kind may stand in,
// but only a qualified one. Never filler.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, config, readLedger, today } from "./queue.mjs";
import { APPROVALS_URL } from "./approval.mjs";

const PLAN = join(ROOT, "reels-plan.json");
export const PAUSE_FILE = join(ROOT, "PAUSE");
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const WEEK = config.week ?? {
  mon: "reel", tue: "carousel", wed: "reel", thu: "reel", fri: "carousel", sat: "reel", sun: "rest",
};

/** "reel", "carousel" or "rest" for a Madeira date (YYYY-MM-DD). */
export function slotFor(day = today()) {
  const d = new Date(day + "T12:00:00Z");
  return WEEK[DAYS[d.getUTCDay()]] ?? "rest";
}

/**
 * Pause, vetoes and pinned days in one read. Throws when it cannot be read.
 * A PAUSE file in ig-auto/ also stops everything: it works even when the
 * portal is down, from any phone that can edit the repo.
 */
export async function readControls() {
  if (existsSync(PAUSE_FILE)) {
    return { paused: true, reason: readFileSync(PAUSE_FILE, "utf-8").trim() || "PAUSE file in ig-auto",
      skipped: new Set(), approved: new Map() };
  }
  const res = await fetch(APPROVALS_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`the portal answered HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.items) || typeof body.paused !== "boolean") {
    throw new Error("the portal answer has no pause flag or no list");
  }
  return {
    paused: body.paused,
    reason: body.pause_reason ?? "",
    skipped: new Set(body.skipped ?? []),
    approved: new Map(body.items.map((x) => [x.id, x])),
  };
}

/** Ids that already went out, from the ledger (the only record with proof). */
export function postedIds(ledger = readLedger()) {
  return new Set(ledger.filter((e) => e.ok && e.id).map((e) => e.id));
}

export function readReelPlan() {
  return existsSync(PLAN) ? JSON.parse(readFileSync(PLAN, "utf-8")) : { reels: [] };
}

/** Why a Reel may not go out, or null when it may. */
export function reelProblem(r, plan, { posted, skipped }) {
  if (posted.has(r.id)) return "already posted";
  if (skipped.has(r.id)) return "vetoed";
  if (r.test && !config.allow_test_reels) return "test format, not in the rotation";
  if (plan.version && r.version !== plan.version) return `built with ${r.version}, plan is ${plan.version}`;
  if (!r.checks?.ok) return `failed its checks: ${(r.checks?.problems ?? ["never checked"]).join("; ")}`;
  if (!r.video || !r.clean_cover) return "no video or no cover";
  return null;
}

/** The Reel as a queue-shaped item, so publish() and the ledger treat it like any post. */
export function reelItem(r) {
  const tags = (r.hashtags ?? []).join(" ");
  return {
    id: r.id, kind: "feed", media: "video", source: "reel", angle: r.subject || "reel",
    origin: `reels/${r.id}`, url: r.video, cover_url: r.clean_cover,
    caption: r.caption, hashtags: r.hashtags ?? [],
    rendered_caption: tags ? `${r.caption}\n\n${tags}` : r.caption,
    created: r.checks?.at ?? "", format: r.format,
  };
}

/** Qualified Reels in plan order; a pinned one (approved for today or earlier) first. */
export function qualifiedReels(plan, ctl, posted, day = today()) {
  const ok = (plan.reels ?? []).filter((r) => !reelProblem(r, plan, { posted, skipped: ctl.skipped }));
  const pinned = ok.filter((r) => ctl.approved.get(r.id)?.day <= day);
  const later = new Set(ok.filter((r) => ctl.approved.get(r.id)?.day > day).map((r) => r.id));
  return [...pinned, ...ok.filter((r) => !pinned.includes(r) && !later.has(r.id))];
}

/** Queue items that may go out: not vetoed, not pinned to a later day, carousels before singles. */
export function qualifiedQueue(queue, ctl, posted, day = today()) {
  return queue
    .filter((i) => !ctl.skipped.has(i.id) && !posted.has(i.id))
    .filter((i) => !(ctl.approved.get(i.id)?.day > day))
    .filter((i) => i.media !== "video" || i.checked === true);
}

/**
 * The feed post for today, or {item: null, why}.
 * chooseQueued is post.mjs's own order for the photo queue (curated sets,
 * then fresh photos, then the colour plan).
 */
export function pickFeed({ day = today(), plan, queue, ctl, posted, chooseQueued }) {
  const slot = slotFor(day);
  if (slot === "rest") return { item: null, why: `${day} is a rest day` };
  const reels = qualifiedReels(plan, ctl, posted, day);
  const photos = qualifiedQueue(queue, ctl, posted, day);
  const reel = reels.length ? reelItem(reels[0]) : null;
  const carousel = photos.length ? chooseQueued(photos) : null;
  const [first, second] = slot === "reel" ? [reel, carousel] : [carousel, reel];
  if (first) return { item: first, slot, stand_in: false };
  if (second) return { item: second, slot, stand_in: true };
  return { item: null, why: `nothing qualified for a ${slot} day` };
}
