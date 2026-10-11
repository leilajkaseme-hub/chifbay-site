// crosspost.mjs — the same post, on the Facebook Page and on Threads, a few minutes after Instagram.
//
// Theo, 11 Oct 2026: post on Instagram, the Facebook Page and Threads every day, and the stories on
// all three "if possible". Facebook Page: feed photo, carousel, Reel and story. Threads: feed only
// (Threads has no stories). Instagram is always first and never waits for this: a failure here is
// written in its own ledger (crosspost-ledger.jsonl) and its own alert, and the Instagram record is
// never touched.
//
// Published once: a post that has an ok line in the crosspost ledger is never sent again; a failed
// one is tried again on the next run (twice a day) for `days_back` days, at most 4 times.
//
// Facebook uses the Page token of the same System User token as Instagram (permissions checked on
// 11 Oct 2026: pages_manage_posts, publish_video). Threads needs its own token: see README.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, config, readLedger } from "./queue.mjs";
import { assertImageIsLive, graphCall, slideUrls } from "./publish.mjs";
import { readReelPlan, reelItem } from "./autopilot.mjs";
import { altFor, fewTags } from "./seo.mjs";
import { alert } from "./notify.mjs";
import { writeFor } from "./voice.mjs";

export const THREADS = "https://graph.threads.net/v1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, process.env.IG_TEST_FAST === "1" ? 1 : ms));
const LEDGER = process.env.CROSSPOST_LEDGER || join(ROOT, "crosspost-ledger.jsonl");
const MAX_TRIES = 4;

// ---- the words ------------------------------------------------------------------------------

/** The caption as written for Instagram, without its hashtag block. */
export function bodyOf(item) {
  let t = String(item.caption ?? item.rendered_caption ?? "");
  t = t.replace(/\n+(?:#[\p{L}\p{N}_]+\s*)+$/u, "");
  return t.trim();
}

/** Instagram-only phrases ("link in bio") become the real link, which works on Facebook and Threads. */
export function withoutBioLink(text) {
  return text
    .replace(/[ \t]*(?:the )?(?:booking )?link in (?:our )?bio[^\n.!?]*[.!?]?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const bookUrl = (channel, id) =>
  `${config.site_url ?? "https://chifbay.com"}/?utm_source=${channel}&utm_medium=social&utm_campaign=${encodeURIComponent(id)}`;

/** The same id always gives the same answer: 1 Threads post in 3 carries the link, the others are just words. */
const linkOnThreads = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 3 === 0; };

/**
 * Facebook: the written text (voice.mjs) and a plain link on its own line. `text` is null when Claude
 * could not write one: then the Instagram caption is used, without its hashtags and "link in bio".
 */
export function facebookMessage(item, text = null) {
  const body = text ?? withoutBioLink(bodyOf(item));
  return `${body}\n\n${bookUrl("facebook", item.id)}`;
}

/** Threads: short. The written text; without one, the first lines of the caption that fit in 230 characters. */
export function threadsText(item, text = null) {
  let out = text;
  if (!out) {
    const paras = withoutBioLink(bodyOf(item)).split(/\n+/).map((p) => p.trim()).filter(Boolean);
    out = "";
    for (const p of paras) { const next = out ? `${out}\n${p}` : p; if (next.length > 230) break; out = next; }
    if (!out) out = (paras[0] ?? "").slice(0, 228).replace(/\s+\S*$/, "") + "…";
  }
  return linkOnThreads(item.id) ? `${out}\n\n${bookUrl("threads", item.id)}` : out;
}

// ---- what is waiting ------------------------------------------------------------------------

const readLines = (file) => (existsSync(file)
  ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
  : []);
export const crossLedger = () => readLines(LEDGER);
const writeCross = (entry) => appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");

/** The full post for an Instagram ledger line: queue item, Reel plan entry, or the ledger line itself. */
export function loadItem(entry) {
  const posted = join(ROOT, "posted", `${entry.id}.json`);
  if (existsSync(posted)) return { ...JSON.parse(readFileSync(posted, "utf8")), kind: entry.kind };
  const reel = (readReelPlan().reels ?? []).find((r) => r.id === entry.id);
  if (reel) return { ...reelItem(reel), kind: entry.kind };
  return entry;
}

/** Instagram posts of the last days that a channel has not got yet, oldest first. */
export function waiting(channel, { days = config.crosspost?.days_back ?? 3, now = Date.now(), igLedger = readLedger(), cross = crossLedger(), only = process.env.CROSSPOST_ONLY } = {}) {
  const done = new Set(cross.filter((e) => e.channel === channel && e.ok).map((e) => e.id));
  // CROSSPOST_ONLY=id1,id2 (manual run): exactly these Instagram posts, whatever their age.
  if (only) {
    const want = new Set(String(only).split(",").map((x) => x.trim()).filter(Boolean));
    return igLedger.filter((e) => e.ok && want.has(e.id) && (e.kind === "feed" || e.kind === "story") && !done.has(e.id)
      && (channel !== "threads" || e.kind === "feed")).sort((a, b) => a.at.localeCompare(b.at));
  }
  const tries = new Map();
  for (const e of cross.filter((e) => e.channel === channel && !e.ok)) tries.set(e.id, (tries.get(e.id) ?? 0) + 1);
  const seen = new Set();
  return igLedger
    .filter((e) => e.ok && e.id && (e.kind === "feed" || e.kind === "story") && e.transport !== "dry-run")
    .filter((e) => now - Date.parse(e.at) < days * 86_400_000)
    .filter((e) => Date.parse(e.at) >= Date.parse(config.crosspost?.since ?? 0)) // nothing from before the channel started
    .filter((e) => (channel === "threads" ? e.kind === "feed" : true))
    .filter((e) => !done.has(e.id) && (tries.get(e.id) ?? 0) < MAX_TRIES)
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => a.at.localeCompare(b.at));
}

// ---- Facebook Page --------------------------------------------------------------------------

async function pageToken(userToken, page) {
  const r = await graphCall(`/${page}`, { fields: "access_token", access_token: userToken }, "GET");
  if (!r.access_token) throw new Error("no Page access token: the token needs a role on the Facebook Page");
  return r.access_token;
}

/** Video upload by URL (Reels and video stories): Facebook fetches the file itself. */
async function ruploadFromUrl(uploadUrl, token, fileUrl) {
  const res = await fetch(uploadUrl, {
    method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: fileUrl }, signal: AbortSignal.timeout(300_000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false || j.error) throw new Error(`video upload refused: ${JSON.stringify(j).slice(0, 240)}`);
}

async function waitForVideo(videoId, token, { timeoutMs = 600_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await graphCall(`/${videoId}`, { fields: "status", access_token: token }, "GET").catch(() => ({}));
    const st = v.status?.video_status;
    if (st === "error") throw new Error(`Facebook refused the video: ${JSON.stringify(v.status).slice(0, 240)}`);
    if (st === "ready" || v.status?.publishing_phase?.status === "complete") return true;
    await sleep(10_000);
  }
  return false; // still processing: published all the same, only not confirmed yet
}

export async function facebook(item, { userToken = process.env.IG_ACCESS_TOKEN, page = process.env.FB_PAGE_ID || config.fb_page_id, text = null } = {}) {
  if (!userToken) throw new Error("IG_ACCESS_TOKEN is not set");
  if (!page) throw new Error("no fb_page_id in config.json");
  const token = await pageToken(userToken, page);
  const urls = slideUrls(item);
  const isVideo = item.media === "video";

  if (item.kind === "story") {
    if (isVideo) {
      const start = await graphCall(`/${page}/video_stories`, { upload_phase: "start", access_token: token });
      await ruploadFromUrl(start.upload_url, token, urls[0]);
      const end = await graphCall(`/${page}/video_stories`, { video_id: start.video_id, upload_phase: "finish", access_token: token });
      return { remote_id: end.post_id ?? start.video_id };
    }
    const photo = await graphCall(`/${page}/photos`, { url: urls[0], published: false, access_token: token });
    const st = await graphCall(`/${page}/photo_stories`, { photo_id: photo.id, access_token: token });
    return { remote_id: st.post_id ?? photo.id };
  }

  const message = facebookMessage(item, text);
  if (isVideo) {
    const start = await graphCall(`/${page}/video_reels`, { upload_phase: "start", access_token: token });
    await ruploadFromUrl(start.upload_url, token, urls[0]);
    const end = await graphCall(`/${page}/video_reels`, {
      video_id: start.video_id, upload_phase: "finish", video_state: "PUBLISHED", description: message, access_token: token,
    });
    const ready = await waitForVideo(start.video_id, token);
    return { remote_id: end.post_id ?? start.video_id, unverified: ready ? undefined : "still processing" };
  }
  if (urls.length === 1) {
    const r = await graphCall(`/${page}/photos`, { url: urls[0], message, alt_text_custom: altFor(item, 0).slice(0, 400), published: true, access_token: token });
    return { remote_id: r.post_id ?? r.id };
  }
  const ids = [];
  for (const [i, url] of urls.entries()) {
    const p = await graphCall(`/${page}/photos`, { url, published: false, alt_text_custom: altFor(item, i).slice(0, 400), access_token: token });
    if (!p.id) throw new Error(`no photo id for slide ${i + 1}`);
    ids.push(p.id);
  }
  const r = await graphCall(`/${page}/feed`, { message, attached_media: ids.map((media_fbid) => ({ media_fbid })), access_token: token });
  return { remote_id: r.id };
}

/** Did this post go out after all (a timeout can hide a success)? Feed posts only; matched on the campaign tag in its link. */
export async function facebookHas(item, sinceMs, { userToken = process.env.IG_ACCESS_TOKEN, page = process.env.FB_PAGE_ID || config.fb_page_id } = {}) {
  if (item.kind === "story") return null;
  const token = await pageToken(userToken, page);
  const r = await graphCall(`/${page}/posts`, { fields: "id,message,created_time", limit: "8", access_token: token }, "GET");
  const tag = `utm_campaign=${encodeURIComponent(item.id)}`;
  const hit = (r.data ?? []).find((x) => Date.parse(x.created_time) >= sinceMs - 120_000 && String(x.message ?? "").includes(tag));
  return hit ? hit.id : null;
}

// ---- Threads --------------------------------------------------------------------------------

async function thCall(path, params, method = "POST") {
  const url = new URL(`${THREADS}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { method, signal: AbortSignal.timeout(120_000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    const e = j.error ?? {};
    throw new Error(`threads ${path}: ${e.message ?? res.status}${e.code != null ? ` [code ${e.code}]` : ""}`);
  }
  return j;
}

async function thReady(id, token, { timeoutMs = 300_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await thCall(`/${id}`, { fields: "status,error_message", access_token: token }, "GET");
    if (s.status === "FINISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads refused the media: ${s.error_message ?? s.status}`);
    await sleep(5_000);
  }
  throw new Error("Threads never finished the media");
}

/**
 * The Threads token and account. Two GitHub secrets seed it (THREADS_ACCESS_TOKEN, THREADS_USER_ID);
 * the booking Worker then keeps the live copy (route /v1/ig/threads-token, same secret as the board
 * sync, IG_SYNC_SECRET) because a Threads token lasts 60 days and a workflow cannot rewrite its own
 * secrets. Each run: use the Worker's copy, renew it when it is 25 days old and put the new one back.
 * A new token in the GitHub secret replaces the stored one (compared by `origin`). Null = not connected.
 */
const RENEW_AFTER_MS = 25 * 86_400_000;
const workerUrl = () => `${(config.approvals_url ?? "").replace(/\/v1\/ig\/approvals$/, "")}/v1/ig/threads-token`;
const fingerprint = (t) => { let h = 0; for (const c of String(t)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return `${String(t).length}-${h.toString(16)}`; };

export async function threadsAuth(env = process.env, now = Date.now()) {
  const secret = env.IG_SYNC_SECRET;
  // The user id is optional: the token knows it (GET /me), so one secret is enough.
  let seed = null;
  if (env.THREADS_ACCESS_TOKEN) {
    let id = env.THREADS_USER_ID;
    if (!id) {
      const me = await thCall("/me", { fields: "id,username", access_token: env.THREADS_ACCESS_TOKEN }, "GET").catch(() => null);
      id = me?.id;
    }
    if (id) seed = { token: env.THREADS_ACCESS_TOKEN, user_id: String(id), saved_at: Date.parse(env.THREADS_TOKEN_SAVED ?? "") || now, origin: fingerprint(env.THREADS_ACCESS_TOKEN) };
  }
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  const put = (v) => fetch(workerUrl(), { method: "PUT", headers, body: JSON.stringify(v), signal: AbortSignal.timeout(30_000) })
    .then((r) => { if (!r.ok) throw new Error(`token store ${r.status}`); });

  let stored = null;
  if (secret) {
    try {
      const r = await fetch(workerUrl(), { headers, signal: AbortSignal.timeout(30_000) });
      if (r.ok) stored = await r.json();
    } catch { /* the Worker being unreachable must not stop a post: fall back to the secret */ }
  }
  let cur = stored?.token && !(seed && stored.origin !== seed.origin) ? stored : seed;
  if (!cur) return null;
  if (secret && cur === seed) await put(cur).catch((e) => console.warn(`threads: could not store the token (${e.message})`));

  if (now - cur.saved_at > RENEW_AFTER_MS) {
    const url = new URL(`${THREADS.replace("/v1.0", "")}/refresh_access_token`);
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", cur.token);
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) {
      throw new Error(`the Threads token could not be renewed (${j.error?.message ?? res.status}): make a new one in the Meta app and set THREADS_ACCESS_TOKEN`);
    }
    cur = { ...cur, token: j.access_token, saved_at: now };
    if (secret) await put(cur).catch((e) => console.warn(`threads: renewed, but could not store it (${e.message})`));
  }
  return { token: cur.token, user: cur.user_id };
}

export async function threads(item, auth, text = null) {
  if (!auth) throw new Error("Threads is not connected (THREADS_ACCESS_TOKEN / THREADS_USER_ID)");
  const { token, user } = auth;
  const body = threadsText(item, text);
  const urls = slideUrls(item);
  const tag = process.env.THREADS_TOPIC ?? "Madeira";
  const make = async (params) => {
    try { return await thCall(`/${user}/threads`, { ...params, topic_tag: tag, access_token: token }); }
    catch (err) {
      if (!/topic/i.test(err.message)) throw err;
      return thCall(`/${user}/threads`, { ...params, access_token: token });
    }
  };
  let creation;
  if (item.media === "video") {
    creation = await make({ media_type: "VIDEO", video_url: urls[0], text: body });
    await thReady(creation.id, token);
  } else if (urls.length > 1) {
    const kids = [];
    for (const image_url of urls.slice(0, 20)) {
      const c = await thCall(`/${user}/threads`, { media_type: "IMAGE", image_url, is_carousel_item: true, access_token: token });
      await thReady(c.id, token);
      kids.push(c.id);
    }
    creation = await make({ media_type: "CAROUSEL", children: kids.join(","), text: body });
    await thReady(creation.id, token);
  } else {
    creation = await make({ media_type: "IMAGE", image_url: urls[0], text: body });
    await thReady(creation.id, token);
  }
  if (!creation.id) throw new Error("no Threads container id");
  const out = await thCall(`/${user}/threads_publish`, { creation_id: creation.id, access_token: token });
  const seen = await thCall(`/${out.id}`, { fields: "permalink", access_token: token }, "GET").catch(() => ({}));
  return { remote_id: out.id, permalink: seen.permalink };
}

// ---- the run --------------------------------------------------------------------------------

/** Written text for one channel; tests replace this. */
export let writeText = async (channel, item, recent, log) => writeFor(channel, item, { recent, log });
export const setWriter = (fn) => { writeText = fn; };

const CHANNELS = {
  facebook: {
    ready: () => (process.env.IG_ACCESS_TOKEN ? null : "IG_ACCESS_TOKEN is not set"),
    send: (item, text) => facebook(item, { text }),
    has: (item, since) => facebookHas(item, since),
  },
  threads: {
    auth: null,
    async ready() {
      try { this.auth = await threadsAuth(); } catch (err) { return `token problem: ${err.message}`; }
      return this.auth ? null : "not connected yet (THREADS_ACCESS_TOKEN and THREADS_USER_ID are not set)";
    },
    send(item, text) { return threads(item, this.auth, text); },
    has: async () => null,
  },
};

/**
 * Send every waiting post to every connected channel. Returns a summary; never throws for a
 * channel failure (it is recorded and alerted), so Instagram's job stays green.
 */
export async function crosspostAll({ kinds = ["feed", "story"], dry = false, log = console.log, igLedger } = {}) {
  const summary = { sent: 0, failed: 0, skipped: [] };
  for (const [channel, impl] of Object.entries(CHANNELS)) {
    if (config.crosspost?.[channel] === false) continue;
    // A channel that is not connected yet is a normal state, not a failure. A token that cannot be
    // renewed is: that one alerts (once per run), because posts are waiting.
    const blocked = await impl.ready();
    if (blocked) {
      log(`${channel}: ${blocked}`);
      summary.skipped.push(channel);
      if (/token problem/.test(blocked) && waiting(channel, { igLedger }).length) await alert(`CHIFBAY ${channel} is stuck`, blocked);
      continue;
    }
    for (const entry of waiting(channel, { igLedger }).filter((e) => kinds.includes(e.kind))) {
      const item = loadItem(entry);
      if (dry) { log(`[dry-run] ${channel} would get ${entry.kind} ${entry.id}`); continue; }
      const started = Date.now();
      try {
        for (const url of slideUrls(item)) await assertImageIsLive(url);
        let out = await impl.has(item, started).catch(() => null).then((id) => (id ? { remote_id: id, recovered: true } : null));
        let text = null;
        if (!out) {
          // A story has no words. Anything else gets a text written for this channel (voice.mjs), or, when
          // Claude is not available, the plain adaptation of the Instagram caption: never a missed post.
          if (entry.kind !== "story") {
            const recent = crossLedger().filter((e) => e.channel === channel && e.text).slice(-6).map((e) => e.text).reverse();
            text = await writeText(channel, item, recent, log);
          }
          out = await impl.send(item, text);
        }
        writeCross({ ok: true, channel, kind: entry.kind, id: entry.id, writer: text ? "claude" : "plain", ...(text ? { text } : {}), ...out });
        log(`${channel}: ${entry.kind} ${entry.id} -> ${out.remote_id}${out.recovered ? " (was already there)" : ""}`);
        summary.sent++;
      } catch (err) {
        const why = String(err?.message ?? err).slice(0, 400);
        const before = crossLedger().filter((e) => e.channel === channel && e.id === entry.id && !e.ok).length;
        writeCross({ ok: false, channel, kind: entry.kind, id: entry.id, error: why });
        log(`${channel}: ${entry.kind} ${entry.id} FAILED: ${why}`);
        summary.failed++;
        if (before + 1 >= MAX_TRIES) {
          await alert(`CHIFBAY ${channel} gave up`, `${entry.kind} ${entry.id} failed ${MAX_TRIES} times: ${why}`);
        } else if (before === 0) {
          await alert(`CHIFBAY ${channel} ${entry.kind} not posted`, `${entry.id}: ${why}\n\nThe next run tries again.`);
        }
      }
    }
  }
  return summary;
}
