// test-fake-fetch.mjs: loaded with --import by test-auto.mjs, never in production.
// Replaces fetch with a fake portal, a fake chifbay.com and a fake Instagram
// that behave like the real ones, steered by FAKE_SCENARIO. Every call is
// written to FAKE_LOG so the test can count them.
import { appendFileSync } from "node:fs";

const S = JSON.parse(process.env.FAKE_SCENARIO || "{}");
const LOG = process.env.FAKE_LOG;
const log = (line) => LOG && appendFileSync(LOG, line + "\n");
const res = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let published = null;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? "GET";
  if (url.hostname === "ntfy.sh") { log(`ntfy ${init.headers?.Title ?? ""}`); return new Response("ok"); }
  if (url.pathname === "/v1/ig/approvals") {
    log("GET approvals");
    if (S.approvalsDown) return res({ error: "down" }, 500);
    return res({ items: S.approved ?? [], skipped: S.skipped ?? [], posted: [], paused: !!S.paused, pause_reason: S.paused ? "test" : "" });
  }
  if (/chifbay\.com$/.test(url.hostname)) {
    log(`HEAD ${url.pathname}`);
    return new Response(null, { status: S.deadMedia ? 404 : 200 });
  }
  if (url.hostname === "graph.facebook.com") {
    const path = url.pathname;
    log(`${method} ${path}`);
    if (method === "POST" && path.endsWith("/media")) {
      log("BODY " + init.body);
      if (S.slow) await wait(400);
      if (S.tokenExpired) return res({ error: { message: "Error validating access token: Session has expired", code: 190, type: "OAuthException" } }, 400);
      return res({ id: "CONTAINER1" });
    }
    if (method === "GET" && path.endsWith("/CONTAINER1")) {
      return res({ status_code: S.containerError ? "ERROR" : "FINISHED", status: S.containerError ? "file incomplete" : "" });
    }
    if (method === "POST" && path.endsWith("/media_publish")) {
      published = { id: "MEDIA1", at: new Date().toISOString() };
      if (S.publishTimesOutButPosts) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return res({ id: "MEDIA1" });
    }
    if (method === "GET" && path.endsWith("/1784/media")) {
      // The account's recent posts: after a timed out publish, the post is there.
      const data = published && S.publishTimesOutButPosts
        ? [{ id: "MEDIA1", caption: lastCaption, timestamp: published.at }] : [];
      return res({ data });
    }
    if (method === "GET" && path.endsWith("/MEDIA1")) {
      return res({ id: "MEDIA1", permalink: "https://www.instagram.com/reel/FAKE/", media_type: "VIDEO", timestamp: new Date().toISOString() });
    }
    return res({ error: { message: `fake: no route ${method} ${path}` } }, 404);
  }
  throw new Error(`fake fetch: unexpected ${url}`);
};

// The caption Meta would show is the one sent with the container.
let lastCaption = "";
const inner = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  if (init.body && String(input).endsWith("/media")) {
    try { lastCaption = JSON.parse(init.body).caption ?? ""; } catch { /* not json */ }
  }
  return inner(input, init);
};
