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
async function graphCall(path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
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
  const container = await graphCall(`/${user}/media`, {
    image_url: item.url,
    access_token: token,
    ...(isStory ? { media_type: "STORIES" } : { caption: item.rendered_caption }),
  });
  if (!container.id) throw new Error(`no container id: ${JSON.stringify(container).slice(0, 200)}`);

  const out = await graphCall(`/${user}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
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
