#!/usr/bin/env node
// shorts-post.mjs: two short videos a day on Instagram (Reel), Facebook, Threads, YouTube Shorts and TikTok.
//
// Runs every hour (workflow shorts-post.yml); GitHub's clock drifts by hours, so the job does not trust its own
// start time: it looks for a slot of the day (shorts/config.json, Madeira time) whose time has passed and that
// has no post yet, and fills the oldest one. A slot more than max_late_hours late is let go rather than stacked.
//
// Only a video Theo said OK to on the review page (chifbay.com/shorts/review.html) can go out (his rule,
// 17 Oct 2026: never post a video he did not approve). The Instagram pause (portal button or ig-auto/PAUSE) and
// the pause on the review page both stop everything. Nothing posts when the approvals cannot be read.
//
// Order per video: Instagram first (it is the main account); then each other channel on its own, so one
// refusing never stops the others; a channel that failed is retried on the next runs (3 tries).
//
//   node bin/shorts-post.mjs          the normal hourly run
//   node bin/shorts-post.mjs --dry    say what would happen, post nothing
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, appendLedger, config as igConfig } from "../lib/queue.mjs";
import { publish, verifyMedia, findRecentPost } from "../lib/publish.mjs";
import { readControls } from "../lib/autopilot.mjs";
import { facebook, threads, threadsAuth } from "../lib/crosspost.mjs";
import { ensurePlaylist, findShort, postShort, ytToken } from "../lib/youtube.mjs";
import { alert, inbox } from "../lib/notify.mjs";

const SHORTS = join(ROOT, "..", "shorts");
const PLAN = join(SHORTS, "plan.json");
const CONFIG = join(SHORTS, "config.json");
const LEDGER = join(SHORTS, "ledger.jsonl");
const CROSS = join(ROOT, "crosspost-ledger.jsonl");
const MEDIA = process.env.MEDIA_URL || "https://chifbay-media.chifandcopt.workers.dev";
const TIKTOK = process.env.TIKTOK_URL || "https://chifbay-tiktok.chifandcopt.workers.dev";
const DRY = process.argv.includes("--dry");
const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
const MAX_TRIES = 3;

const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const lines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const record = (e) => appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");
const savePlan = (plan) => writeFileSync(PLAN, JSON.stringify(plan, null, 1) + "\n");

/** Madeira wall-clock parts of a Date. */
function local(d = new Date(), tz = cfg.timezone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The same date and slot always get the same small drift, so a person-like time is not a fixed one. */
function slotMinutes(day, i) {
  const [h, m] = cfg.slots[i].split(":").map(Number);
  let x = 0;
  for (const c of `${day}#${i}`) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return h * 60 + m + (x % (2 * cfg.jitter_minutes + 1)) - cfg.jitter_minutes;
}

export function dueSlot(now = new Date(), ledger = lines(LEDGER)) {
  const { day, minutes } = local(now);
  const filled = new Set(ledger.filter((e) => e.slot && (e.ok || e.missed)).map((e) => e.slot));
  for (let i = 0; i < cfg.slots.length; i++) {
    const key = `${day}#${i}`;
    const at = slotMinutes(day, i);
    if (filled.has(key) || minutes < at) continue;
    if (minutes - at > cfg.max_late_hours * 60) { record({ slot: key, missed: true, why: `run came ${Math.round((minutes - at) / 60)} h late` }); continue; }
    return key;
  }
  return null;
}

async function approvals() {
  const r = await fetch(`${MEDIA}/approvals`, { headers: { Authorization: `Bearer ${process.env.IG_SYNC_SECRET}`, "User-Agent": "chifbay-shorts/1.0" },
    signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`the review store answered ${r.status}`);
  const j = await r.json();
  if (!j.decisions || typeof j.paused !== "boolean") throw new Error("the review store answer has no decisions");
  return j;
}

/** Next approved video: plan order, but not one sharing a source file with the last two posted. */
export function nextVideo(plan, decisions) {
  const ready = plan.videos.filter((v) => v.status === "rendered" && v.render?.checks?.ok && decisions[v.id]?.d === "ok" && !v.posted?.instagram);
  const posted = plan.videos.filter((v) => v.posted?.instagram).sort((a, b) => a.posted.instagram.at.localeCompare(b.posted.instagram.at));
  const recent = new Set(posted.slice(-2).flatMap((v) => v.shots.map((s) => s.name)));
  return ready.find((v) => !v.shots.some((s) => recent.has(s.name))) ?? ready[0] ?? null;
}

function igItem(v) {
  const t = v.texts;
  const tags = (t.hashtags ?? []).join(" ");
  return {
    id: v.id, kind: "feed", media: "video", source: "short", angle: v.format, origin: `shorts/${v.id}`,
    url: v.render.video, cover_url: v.render.cover, caption: t.ig, hashtags: t.hashtags ?? [],
    rendered_caption: tags ? `${t.ig}\n\n${tags}` : t.ig, alt: t.alt,
  };
}

const tries = (id, ch) => lines(LEDGER).filter((e) => e.id === id && e.channel === ch && !e.ok).length;

async function instagram(v, slot) {
  const item = igItem(v);
  const startedAt = Date.now();
  let result, lastErr;
  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    try { result = await publish(item); }
    catch (err) {
      lastErr = err;
      const already = await findRecentPost(item, startedAt).catch(() => null);
      if (already) result = { transport: "graph", media_id: already, recovered: true };
      else if (/code 190\b|OAuthException|token/i.test(err.message)) break;
      else await new Promise((r) => setTimeout(r, 60_000 * attempt));
    }
  }
  if (!result) throw lastErr;
  const seen = await verifyMedia(result.media_id).catch(() => null);
  const permalink = seen?.permalink ?? null;
  // the Instagram ledger too: insights and the heartbeat count it, and the cross-poster finds it if a channel below fails
  appendLedger({ ok: true, kind: "feed", id: v.id, source: "short", origin: item.origin, angle: v.format, media: "video",
    url: item.url, cover_url: item.cover_url, caption: item.caption, rendered_caption: item.rendered_caption,
    hashtags: item.hashtags, transport: result.transport, media_id: result.media_id, permalink });
  return { id: result.media_id, url: permalink, slot };
}

const CHANNELS = {
  async facebook(v) {
    const r = await facebook(igItem(v), { text: v.texts.fb });
    return { id: r.remote_id ?? null, url: r.remote_id ? `https://www.facebook.com/${r.remote_id}` : null };
  },
  async threads(v) {
    const auth = await threadsAuth();
    const r = await threads(igItem(v), auth, v.texts.threads);
    return { id: r.remote_id, url: r.permalink ?? null };
  },
  async youtube(v, plan) {
    const token = await ytToken();
    const done = await findShort(token, v.texts.yt_title).catch(() => null);
    if (done) return { id: done, url: `https://www.youtube.com/shorts/${done}`, recovered: true };
    if (!cfg.youtube.playlist_id) {
      cfg.youtube.playlist_id = await ensurePlaylist(token, cfg.youtube.playlist_title, cfg.youtube.playlist_description);
      writeFileSync(CONFIG, JSON.stringify(cfg, null, 1) + "\n");
    }
    const recordedOn = v.recorded ?? null;
    return postShort(v, { token, playlist: cfg.youtube.playlist_id, location: cfg.location, recordedOn });
  },
  async tiktok(v) {
    const r = await fetch(`${TIKTOK}/video-draft`, {
      method: "POST", headers: { Authorization: `Bearer ${process.env.IG_SYNC_SECRET}`, "Content-Type": "application/json", "User-Agent": "chifbay-shorts/1.0" },
      body: JSON.stringify({ video_url: v.render.video }), signal: AbortSignal.timeout(300_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(`TikTok draft refused: ${j.error ?? r.status} ${JSON.stringify(j.detail ?? "").slice(0, 160)}`);
    await inbox("Chifbay: a TikTok draft is ready",
      `Open TikTok > Inbox (the upload notice), add a sound if you like, paste this caption and tap Post:\n\n${v.texts.tiktok}`);
    return { id: j.publish_id, url: null, mode: j.mode };
  },
};

async function sendOthers(v, plan, log) {
  for (const ch of Object.keys(CHANNELS)) {
    if (!cfg.channels[ch] || v.posted?.[ch]) continue;
    if (tries(v.id, ch) >= MAX_TRIES) continue;
    if (DRY) { log(`[dry] would send ${v.id} to ${ch}`); continue; }
    try {
      const r = await CHANNELS[ch](v, plan);
      v.posted = { ...v.posted, [ch]: { at: new Date().toISOString(), ...r } };
      record({ ok: true, id: v.id, channel: ch, ...r });
      if (ch === "facebook" || ch === "threads") {
        appendFileSync(CROSS, JSON.stringify({ at: new Date().toISOString(), ok: true, channel: ch, id: v.id, kind: "feed", remote_id: r.id, permalink: r.url }) + "\n");
      }
      log(`  ${ch}: ${r.url ?? r.id ?? "ok"}`);
    } catch (err) {
      const why = String(err?.message ?? err).slice(0, 400);
      record({ ok: false, id: v.id, channel: ch, error: why });
      log(`  ${ch} FAILED: ${why}`);
      if (tries(v.id, ch) >= MAX_TRIES) await alert(`Chifbay short ${v.id}: ${ch} gave up`, `${why}\n\nInstagram and the other channels are not affected.`);
    }
    savePlan(plan);
  }
}

async function main() {
  const log = console.log;
  if (!cfg.live && !DRY) { log("shorts posting is not live yet (shorts/config.json live=false)"); return; }
  const plan = readJson(PLAN, { videos: [] });
  let rev, ctl;
  try {
    [rev, ctl] = await Promise.all([approvals(), readControls()]);
  } catch (err) {
    log(`not posting: approvals or pause unreadable (${err.message})`);
    await alert("Chifbay shorts held", `The approvals or the pause could not be read (${err.message}), so nothing was posted.`);
    return;
  }
  if (rev.paused || ctl.paused) { log(`not posting: PAUSED (${rev.paused ? "review page" : ctl.reason})`); return; }

  // 1. channels that failed earlier for videos already on Instagram
  for (const v of plan.videos.filter((x) => x.posted?.instagram)) await sendOthers(v, plan, log);

  // 2. the slot
  const slot = dueSlot();
  if (!slot) { log("no slot due now"); return; }
  const last = lines(LEDGER).filter((e) => e.channel === "instagram" && e.ok).at(-1);
  if (last && Date.now() - Date.parse(last.at) < cfg.min_gap_hours * 3_600_000) { log(`slot ${slot} waits: last post ${last.at}`); return; }
  const v = nextVideo(plan, rev.decisions);
  if (!v) {
    log(`slot ${slot}: no approved video waiting`);
    const waiting = plan.videos.filter((x) => x.status === "rendered" && !rev.decisions[x.id]).length;
    await inbox("Chifbay: no approved video for today's slot",
      `${waiting} videos wait for your OK: ${cfg.review_url}`);
    record({ slot, missed: true, why: "nothing approved" });
    return;
  }
  log(`slot ${slot}: ${v.id} ${v.format} "${v.texts.hook}"`);
  if (DRY) { log(`[dry] would post ${v.id} on Instagram`); await sendOthers(v, plan, log); return; }
  try {
    const r = await instagram(v, slot);
    v.posted = { ...v.posted, instagram: { at: new Date().toISOString(), ...r } };
    record({ ok: true, id: v.id, channel: "instagram", slot, ...r });
    savePlan(plan);
    log(`  instagram: ${r.url ?? r.id}`);
  } catch (err) {
    const why = String(err?.message ?? err).slice(0, 400);
    record({ ok: false, id: v.id, channel: "instagram", error: why });
    await alert(`Chifbay short ${v.id}: Instagram FAILED`, `${why}\n\nThe next hourly run tries again.`);
    throw err;
  }
  await sendOthers(v, plan, log);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
