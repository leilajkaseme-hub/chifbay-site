// publish.mjs — the only part that talks to Instagram.
//
// Default transport is "graph": straight to Meta, nobody in the middle. Free,
// with no monthly operation budget and no company that can change its pricing.
// Publishing to your own account from your own app needs no app review.
//
// The usual objection to going direct is the 60-day token. That is solved at
// setup rather than in code — a Business Manager System User token issued with
// expiry "Never" — so there is nothing to refresh and no refresh job that can
// fail silently. bin/token-check.mjs watches it.
//
// "make-webhook" is the fallback that needs no Meta app, because Make owns one.
// It cannot post stories (Make's Instagram app has no create-story module), and
// Make's free plan shares one 1,000-operation monthly pool across every scenario
// in the account, so an unrelated busy webhook can starve it. The strict
// response check in makeWebhook() exists for exactly that case.
import { config } from "./queue.mjs";

async function makeWebhook(item) {
  const hook = process.env.MAKE_IG_WEBHOOK;
  if (!hook) throw new Error("MAKE_IG_WEBHOOK is not set");
  // Make's Instagram app has no create-story module — checked the full list,
  // deprecated ones included. Only "graph" can post a story.
  if (item.kind === "story") {
    throw new Error('the "make-webhook" transport cannot post stories — use the "graph" transport');
  }

  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: item.url, caption: item.rendered_caption, id: item.id }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.text()).trim();
  if (!res.ok) throw new Error(`make webhook ${res.status}: ${body.slice(0, 300)}`);

  // The scenario ends in a Webhook Response module that returns the real post
  // id, so anything else means nothing was published. This check is the whole
  // defence against the one silent failure this setup can have: when the Make
  // organisation runs out of monthly operations, or the scenario is switched
  // off, the webhook still answers a cheerful bare "Accepted" and no post is
  // ever made. Insisting on a real id turns that into a retry and an alert.
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(
      `Make took the request but did not confirm a post — it replied "${body.slice(0, 80)}". ` +
      "Usually this means the scenario is switched off, or the Make organisation " +
      "is out of operations for the month.",
    );
  }
  if (json.ok === false || !json.id) {
    throw new Error(`Make reported no post: ${body.slice(0, 300)}`);
  }
  return { transport: "make-webhook", media_id: String(json.id), confirmed: true };
}

export const GRAPH = "https://graph.facebook.com/v21.0";

/** Meta returns its real reason inside error.message — surface it, not "400". */
async function graphCall(path, body, method = "POST") {
  const url = new URL(`${GRAPH}${path}`);
  const init = { method, signal: AbortSignal.timeout(120_000) };
  if (method === "GET") {
    for (const [k, v] of Object.entries(body)) url.searchParams.set(k, v);
  } else {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    // Meta's short message ("API access blocked.") is often not enough to tell
    // a revoked token from a restricted app from a rate limit. The code, the
    // subcode and the trace id are what support and the docs are keyed on, so
    // carry all of them into the log.
    const bits = [
      e.code != null ? `code ${e.code}` : null,
      e.error_subcode != null ? `subcode ${e.error_subcode}` : null,
      e.type || null,
      e.fbtrace_id ? `fbtrace ${e.fbtrace_id}` : null,
    ].filter(Boolean);
    throw new Error(
      `${path}: ${e.message ?? res.status}` +
      (e.error_user_msg ? ` — ${e.error_user_msg}` : "") +
      (bits.length ? ` [${bits.join(", ")}]` : "") +
      (Object.keys(e).length ? "" : ` raw: ${JSON.stringify(json).slice(0, 300)}`),
    );
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for Meta to finish downloading the image into the container.
 *
 * Creating a container only queues the work — Meta fetches the URL on its own
 * servers afterwards. Publishing before that finishes fails with
 * "Media ID is not available" (code 9007, subcode 2207027). It is a race, so it
 * looks like it works until one day it does not: the very first two posts went
 * out fine and every one after them failed.
 *
 * Meta's own guidance is to poll status_code every few seconds. FINISHED means
 * ready, ERROR means the image itself was refused and no amount of waiting will
 * help, so say that instead of timing out five minutes later.
 */
async function waitForContainer(id, token, { timeoutMs = 300_000, everyMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = "IN_PROGRESS";
  while (Date.now() < deadline) {
    const s = await graphCall(`/${id}`, { fields: "status_code,status", access_token: token }, "GET");
    last = s.status_code ?? "UNKNOWN";
    if (last === "FINISHED") return;
    if (last === "ERROR" || last === "EXPIRED") {
      throw new Error(`Instagram refused the image (${last}): ${s.status ?? "no reason given"}`);
    }
    await sleep(everyMs);
  }
  throw new Error(
    `the media container was still "${last}" after ${Math.round(timeoutMs / 1000)}s — ` +
    "Instagram never finished downloading the image",
  );
}

/**
 * Every picture in this post, in order. The first one is the cover: it is what
 * the grid shows and the only one most people ever see.
 *
 * Single-photo items from before carousels existed still only have `url`, and
 * they must keep working — the queue is committed to the repo and there is no
 * migration step.
 */
export function slideUrls(item) {
  const urls = (item.slides ?? []).map((s) => s.url).filter(Boolean);
  return urls.length ? urls : [item.url];
}

/**
 * A carousel is three rounds of the same two-step dance, not one.
 *
 * Each picture gets its own container with is_carousel_item, and each of those
 * has to finish downloading before it can be attached to anything. Then a
 * parent container holds the children and carries the caption — the children
 * must not have captions of their own. Meta allows 2 to 10 children.
 *
 * The children are built one after another rather than all at once on purpose.
 * They are the same size request repeated, and firing ten at a Graph endpoint
 * that is already rate limited is how you turn a post into a 429.
 */
async function carouselContainer(user, token, urls, caption) {
  if (urls.length > 10) throw new Error(`a carousel takes at most 10 photos, got ${urls.length}`);

  const children = [];
  for (const [i, image_url] of urls.entries()) {
    const child = await graphCall(`/${user}/media`, {
      image_url,
      is_carousel_item: true,
      access_token: token,
    });
    if (!child.id) throw new Error(`no container id for slide ${i + 1}: ${JSON.stringify(child).slice(0, 200)}`);
    await waitForContainer(child.id, token);
    children.push(child.id);
  }

  const parent = await graphCall(`/${user}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: token,
  });
  if (!parent.id) throw new Error(`no carousel container id: ${JSON.stringify(parent).slice(0, 200)}`);

  // The parent has nothing to download — its children are already finished —
  // but Meta still assembles it, and publishing early fails the same way a
  // single photo does.
  await waitForContainer(parent.id, token);
  return parent.id;
}

/**
 * Direct Graph API. Two steps, because Meta fetches the image itself: create a
 * media container pointing at the public URL, then publish that container.
 */
async function graph(item) {
  const user = process.env.IG_USER_ID || config.ig_user_id;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!user) throw new Error("no Instagram account id — set ig_user_id in config.json");
  if (!token) throw new Error("IG_ACCESS_TOKEN is not set");

  // A story takes no caption. The API cannot add text overlays, stickers, polls
  // or link stickers either — those exist only in the phone app. An API story is
  // the picture and nothing else.
  const isStory = item.kind === "story";
  const urls = slideUrls(item);

  let container;
  if (!isStory && urls.length > 1) {
    container = { id: await carouselContainer(user, token, urls, item.rendered_caption) };
  } else {
    container = await graphCall(`/${user}/media`, {
      image_url: urls[0],
      access_token: token,
      ...(isStory ? { media_type: "STORIES" } : { caption: item.rendered_caption }),
    });
    if (!container.id) throw new Error(`no container id: ${JSON.stringify(container).slice(0, 200)}`);
    await waitForContainer(container.id, token);
  }

  // FINISHED is Meta's own answer and it is still occasionally early, so give
  // the same container a few more tries rather than building a new one — a
  // second container means a second download and the same race all over again.
  let out, lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      out = await graphCall(`/${user}/media_publish`, { creation_id: container.id, access_token: token });
      break;
    } catch (err) {
      lastErr = err;
      if (!/9007|2207027|not ready|not available/i.test(err.message) || attempt === 4) throw err;
      console.warn(`container ${container.id} not ready yet, retrying in 10s`);
      await sleep(10_000);
    }
  }
  if (!out) throw lastErr;
  if (!out.id) throw new Error(`no media id: ${JSON.stringify(out).slice(0, 200)}`);
  return { transport: "graph", media_id: out.id, confirmed: true };
}

async function dryRun(item) {
  console.log(`[dry-run] would post ${item.url}\n---\n${item.rendered_caption}\n---`);
  return { transport: "dry-run", media_id: null, confirmed: false };
}

const TRANSPORTS = { "make-webhook": makeWebhook, graph, "dry-run": dryRun };

export async function publish(item) {
  const name = process.env.IG_TRANSPORT || config.transport;
  const fn = TRANSPORTS[name];
  if (!fn) throw new Error(`unknown transport "${name}"`);
  return fn(item);
}

/**
 * The image must already be live before Instagram is told to fetch it — Meta
 * pulls the URL server-side and a 404 fails the whole post. Items are queued
 * days ahead precisely so Pages has long since deployed, but this makes the
 * assumption explicit instead of hoping.
 */
export async function assertImageIsLive(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
      if (res.ok) return true;
    } catch { /* transient — retry below */ }
    if (attempt < 5) await new Promise((r) => setTimeout(r, 15_000 * attempt));
  }
  throw new Error(`image is not reachable at ${url} — refusing to post`);
}
