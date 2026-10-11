#!/usr/bin/env node
// test-crosspost.mjs: the Facebook and Threads sender, run for real against a fake Meta.
//   node test-crosspost.mjs
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "cross-"));
process.env.CROSSPOST_LEDGER = join(dir, "crosspost-ledger.jsonl");
process.env.IG_TEST_FAST = "1";
process.env.IG_ACCESS_TOKEN = "TEST";
process.env.THREADS_ACCESS_TOKEN = "TH";
process.env.THREADS_USER_ID = "777";
process.env.IG_NTFY_OFF = "1";

const calls = [];
let scenario = {};
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input?.url ?? input));
  const method = init.method ?? "GET";
  let body = {};
  try { body = init.body ? JSON.parse(init.body) : {}; } catch { /* a plain-text alert */ }
  const q = Object.fromEntries(url.searchParams);
  const rec = `${method} ${url.host}${url.pathname}`;
  calls.push({ rec, body, q, headers: init.headers ?? {} });
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (method === "HEAD") return new Response(null, { status: scenario.deadMedia ? 404 : 200 });
  if (url.host === "ntfy.sh") return json({ id: "n1" });
  if (url.host === "rupload.facebook.com") return json({ success: true });
  const p = url.pathname.replace(/^\/v21\.0|^\/v1\.0/, "");
  if (url.host === "graph.facebook.com") {
    if (scenario.fbDown) return json({ error: { message: "temporarily unavailable", code: 2 } }, 500);
    if (p === "/PAGE" && method === "GET") return json({ access_token: "PAGETOKEN" });
    if (p === "/PAGE/posts") return json({ data: scenario.already ? [{ id: "PAGE_old", message: scenario.already, created_time: new Date().toISOString() }] : [] });
    if (p === "/PAGE/photos") return json({ id: `photo${calls.length}`, post_id: body.published === false ? undefined : "PAGE_photopost" });
    if (p === "/PAGE/feed") return json({ id: "PAGE_carousel" });
    if (p === "/PAGE/photo_stories") return json({ success: true, post_id: "PAGE_story" });
    if (p === "/PAGE/video_reels") return body.upload_phase === "start"
      ? json({ video_id: "VID1", upload_url: "https://rupload.facebook.com/video-upload/v21.0/VID1" })
      : json({ success: true, post_id: "PAGE_reel" });
    if (p === "/VID1") return json({ status: { video_status: "ready" } });
  }
  if (url.host === "chifbay-booking-api.chifandcopt.workers.dev") {
    if (method === "PUT") { scenario.stored = body; scenario.puts = (scenario.puts ?? 0) + 1; return json({ ok: true }); }
    return scenario.stored ? json(scenario.stored) : json({}, 404);
  }
  if (url.host === "graph.threads.net" && p === "/me") return json({ id: "17841400000", username: "chifbay" });
  if (url.host === "graph.threads.net" && p === "/refresh_access_token") {
    return scenario.refreshFails ? json({ error: { message: "expired" } }, 400) : json({ access_token: "RENEWED_TOKEN_0123456789", expires_in: 5184000 });
  }
  if (url.host === "graph.threads.net") {
    if (scenario.thDown) return json({ error: { message: "oops", code: 4 } }, 400);
    if (p === "/777/threads") return json({ id: `C${calls.length}` });
    if (/^\/C\d+$/.test(p)) return json({ status: "FINISHED" });
    if (p === "/777/threads_publish") return json({ id: "T1" });
    if (p === "/T1") return json({ permalink: "https://www.threads.com/@chifbay/post/T1" });
  }
  return json({ error: { message: `unexpected ${rec}` } }, 404);
};

const m = await import("./lib/crosspost.mjs");
const v = await import("./lib/voice.mjs");
m.setWriter(async () => null); // never call the real Claude in tests: the plain adaptation is used
const { config } = await import("./lib/queue.mjs");
config.fb_page_id = "PAGE";
config.crosspost = { ...config.crosspost, since: "2000-01-01T00:00:00Z", days_back: 5000 };

let passed = 0, failed = 0;
async function check(name, fn) {
  calls.length = 0; scenario = {};
  rmSync(process.env.CROSSPOST_LEDGER, { force: true });
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message.split("\n")[0]}`); }
}

const AUTH = { token: "TH", user: "777" };
const entry = (id, kind = "feed") => ({ ok: true, kind, id, at: new Date().toISOString(), media: "photo", url: `https://www.chifbay.com/ig/${id}.jpg`,
  caption: "Private boat trip from Funchal, Madeira.\n\nOn the water.", hashtags: ["#madeira"] });
const photo = { id: "p1", kind: "feed", media: "photo", url: "https://www.chifbay.com/ig/p1.jpg", slides: [{ url: "https://www.chifbay.com/ig/p1.jpg" }],
  caption: "Private boat trip from Funchal, Madeira.\n\nGlasses up under the cliffs.\nBooking link in bio.", hashtags: ["#madeira", "#funchal", "#boattrip"] };
const carousel = { ...photo, id: "c1", slides: [1, 2, 3].map((n) => ({ url: `https://www.chifbay.com/ig/c1-${n}.jpg` })) };
const reel = { ...photo, id: "r1", media: "video", url: "https://chifbay.com/ig/reels/r1.mp4", cover_url: "https://chifbay.com/ig/reels/r1-cover.jpg", slides: undefined };
const story = { id: "s1", kind: "story", media: "photo", url: "https://www.chifbay.com/ig/s1.jpg" };

console.log("Facebook Page and Threads, against a fake Meta");

await check("plain adaptation: link in bio becomes a real link; Threads fallback is short", () => {
  const fb = m.facebookMessage(photo);
  assert.ok(fb.startsWith("Private boat trip from Funchal, Madeira."));
  assert.ok(!/link in bio/i.test(fb)); assert.match(fb, /utm_source=facebook/); assert.ok(!/#/.test(fb), "no hashtags on Facebook");
  const long = { ...photo, id: "x2", caption: "Private boat trip from Funchal, Madeira.\n" + "A long sentence about the cliffs and the sea. ".repeat(30) };
  const th = m.threadsText(long);
  assert.ok(th.replace(/\n\nhttps:.*$/s, "").length <= 230, `threads text is ${th.length} characters`);
  assert.ok(th.startsWith("Private boat trip"));
});

await check("Threads: only 1 post in 3 carries the link, always the same ones", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `post-${i}`);
  const withLink = ids.filter((id) => /utm_source=threads/.test(m.threadsText({ ...photo, id })));
  assert.ok(withLink.length >= 6 && withLink.length <= 14, `${withLink.length} of 30`);
  assert.deepEqual(withLink, ids.filter((id) => /utm_source=threads/.test(m.threadsText({ ...photo, id }))));
});

await check("voice: the checks refuse spam, hashtags, prices, a missing place and a too long Threads post", () => {
  const ok = "Our skipper swears the cliff at Cabo Girão gets taller every summer. Madeira, from the water.";
  assert.deepEqual(v.problems("threads", ok), []);
  assert.match(v.problems("threads", ok + " #madeira").join(), /hashtags/);
  assert.match(v.problems("threads", "Book now! Don't miss our unforgettable trip in Madeira").join(), /ad words/);
  assert.match(v.problems("threads", "A quiet afternoon on the water, nothing else to report today.").join(), /Funchal or Madeira/);
  assert.match(v.problems("threads", ok + " x".repeat(200)).join(), /too long/);
  assert.match(v.problems("threads", "Boat day in Madeira for 120 euro per person, wow").join(), /price/);
  assert.match(v.problems("threads", "Boat day in Madeira — the best").join(), /long dash/);
  assert.deepEqual(v.problems("facebook", "A".repeat(10)).filter((x) => /short/.test(x)).length, 1);
});

await check("voice: writeFor retries with the reason, then gives a text that passes; null when Claude never does", () => {
  const prompts = [];
  const answers = ["Visit Madeira #boat", "Our skipper says the swim stop at Fajã dos Padres is where plans go to die. Madeira, mid-afternoon, nobody checking the time."];
  const ask = (p) => { prompts.push(p); return JSON.stringify({ text: answers.shift() }); };
  const text = v.writeFor("threads", photo, { ask, log: () => {} });
  assert.match(text, /plans go to die/); assert.equal(prompts.length, 2); assert.match(prompts[1], /hashtags/);
  assert.equal(v.writeFor("threads", photo, { ask: () => "no json here", log: () => {} }), null);
  assert.equal(v.writeFor("threads", photo, { ask: () => { throw new Error("You've hit your weekly limit"); }, log: () => {} }), null);
});

await check("a written text goes to both channels, is kept in the record, and the next one must not sound the same", async () => {
  const sent = [];
  m.setWriter(async (channel, item) => { sent.push(channel); return channel === "threads" ? "Short and Madeira-ish, a little smug about the weather." : "Facebook text about Funchal that is long enough to pass the minimum length of two hundred characters, with a small question at the end so people answer: who would you bring on the boat on a quiet Tuesday afternoon, and what would you pack?"; });
  const out = await m.crosspostAll({ igLedger: [entry("w1")], log: () => {} });
  assert.deepEqual(sent.sort(), ["facebook", "threads"]);
  const fb = calls.find((c) => c.rec.endsWith("/PAGE/photos"));
  assert.match(fb.body.message, /^Facebook text about Funchal/); assert.match(fb.body.message, /utm_campaign=w1$/);
  const th = calls.find((c) => c.rec.endsWith("/777/threads"));
  assert.match(th.q.text, /^Short and Madeira-ish/);
  const led = m.crossLedger();
  assert.ok(led.some((e) => e.channel === "threads" && e.writer === "claude" && e.text.startsWith("Short")));
  m.setWriter(async () => null);
});

await check("Facebook photo: Page token, photo with message and alt text, one call", async () => {
  const r = await m.facebook(photo);
  assert.equal(r.remote_id, "PAGE_photopost");
  const c = calls.find((x) => x.rec.endsWith("/PAGE/photos"));
  assert.equal(c.body.access_token, "PAGETOKEN"); assert.equal(c.body.published, true);
  assert.match(c.body.message, /Funchal/); assert.match(c.body.alt_text_custom, /Madeira/);
});

await check("Facebook carousel: each photo unpublished, then one feed post that attaches them", async () => {
  const r = await m.facebook(carousel);
  assert.equal(r.remote_id, "PAGE_carousel");
  assert.equal(calls.filter((x) => x.rec.endsWith("/PAGE/photos")).length, 3);
  const feed = calls.find((x) => x.rec.endsWith("/PAGE/feed"));
  assert.equal(feed.body.attached_media.length, 3);
});

await check("Facebook Reel: start, upload by URL, finish published with the caption, waits until ready", async () => {
  const r = await m.facebook(reel);
  assert.equal(r.remote_id, "PAGE_reel");
  const up = calls.find((x) => x.rec.startsWith("POST rupload"));
  assert.equal(up.headers.file_url, reel.url); assert.match(up.headers.Authorization, /OAuth PAGETOKEN/);
  const fin = calls.filter((x) => x.rec.endsWith("/PAGE/video_reels")).at(-1);
  assert.equal(fin.body.video_state, "PUBLISHED"); assert.match(fin.body.description, /Funchal/);
});

await check("Facebook story: unpublished photo, then a photo story", async () => {
  const r = await m.facebook(story);
  assert.equal(r.remote_id, "PAGE_story");
  assert.equal(calls.find((x) => x.rec.endsWith("/PAGE/photos")).body.published, false);
  assert.ok(calls.some((x) => x.rec.endsWith("/PAGE/photo_stories")));
});

await check("Threads: image post, text under 500, topic tag, published once, permalink read back", async () => {
  const r = await m.threads(photo, AUTH);
  assert.equal(r.remote_id, "T1"); assert.match(r.permalink, /threads\.com/);
  const c = calls.find((x) => x.rec.endsWith("/777/threads"));
  assert.equal(c.q.media_type, "IMAGE"); assert.equal(c.q.topic_tag, "Madeira"); assert.ok(c.q.text.length <= 500);
  assert.equal(calls.filter((x) => x.rec.endsWith("threads_publish")).length, 1);
});

await check("Threads carousel and video", async () => {
  await m.threads(carousel, AUTH);
  assert.equal(calls.filter((x) => x.q.is_carousel_item === "true").length, 3);
  assert.ok(calls.some((x) => x.q.media_type === "CAROUSEL"));
  calls.length = 0;
  await m.threads(reel, AUTH);
  assert.equal(calls.find((x) => x.rec.endsWith("/777/threads")).q.media_type, "VIDEO");
});

await check("Threads token: none = not connected; the GitHub secret alone works; the Worker keeps the live copy", async () => {
  const NOW = Date.parse("2026-10-11T12:00:00Z");
  assert.equal(await m.threadsAuth({}, NOW), null);
  const seed = { THREADS_ACCESS_TOKEN: "SEEDTOKEN_0123456789012345", THREADS_USER_ID: "17841400000", THREADS_TOKEN_SAVED: "2026-10-10T00:00:00Z" };
  assert.deepEqual(await m.threadsAuth(seed, NOW), { token: "SEEDTOKEN_0123456789012345", user: "17841400000" });
  assert.equal(calls.length, 0, "no secret, no Worker call");
  // with the sync secret: stored on first use
  const r = await m.threadsAuth({ ...seed, IG_SYNC_SECRET: "s" }, NOW);
  assert.equal(r.token, "SEEDTOKEN_0123456789012345"); assert.equal(scenario.puts, 1);
  assert.ok(scenario.stored.origin && scenario.stored.saved_at);
  // second run: the stored copy is used, nothing is written again
  await m.threadsAuth({ ...seed, IG_SYNC_SECRET: "s" }, NOW + 3_600_000);
  assert.equal(scenario.puts, 1);
});

await check("Threads: the token alone is enough, the user id comes from /me", async () => {
  const r = await m.threadsAuth({ THREADS_ACCESS_TOKEN: "ONLYTOKEN_01234567890123456" }, Date.parse("2026-10-11T12:00:00Z"));
  assert.deepEqual(r, { token: "ONLYTOKEN_01234567890123456", user: "17841400000" });
  assert.equal(await m.threadsAuth({ THREADS_ACCESS_TOKEN: "x" }, 0).then((v) => v && v.user), "17841400000");
});

await check("Threads token is renewed at 25 days, the new one stored; a failed renewal says what to do", async () => {
  const seed = { THREADS_ACCESS_TOKEN: "SEEDTOKEN_0123456789012345", THREADS_USER_ID: "17841400000", THREADS_TOKEN_SAVED: "2026-09-01T00:00:00Z", IG_SYNC_SECRET: "s" };
  const NOW = Date.parse("2026-10-11T12:00:00Z"); // 40 days later
  const r = await m.threadsAuth(seed, NOW);
  assert.equal(r.token, "RENEWED_TOKEN_0123456789"); assert.equal(scenario.stored.token, "RENEWED_TOKEN_0123456789");
  assert.equal(scenario.stored.saved_at, NOW);
  // a new token in the GitHub secret replaces the stored one
  const again = await m.threadsAuth({ ...seed, THREADS_ACCESS_TOKEN: "ANOTHERTOKEN_012345678901", THREADS_TOKEN_SAVED: "2026-10-11T00:00:00Z" }, NOW);
  assert.equal(again.token, "ANOTHERTOKEN_012345678901");
  // renewal refused
  scenario = { refreshFails: true };
  await assert.rejects(() => m.threadsAuth(seed, NOW), /could not be renewed/);
});

await check("waiting(): feed to both channels, stories to Facebook only, done and given-up posts skipped, old posts ignored", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const at = (h) => new Date(now - h * 3_600_000).toISOString();
  const ig = [
    { ok: true, kind: "feed", id: "f1", at: at(2) }, { ok: true, kind: "story", id: "s1", at: at(1) },
    { ok: true, kind: "feed", id: "f0", at: at(500) }, { ok: false, kind: "feed", id: "bad", at: at(1) },
    { ok: true, kind: "feed", id: "done", at: at(3) }, { ok: true, kind: "feed", id: "tired", at: at(3) },
  ];
  const cross = [{ ok: true, channel: "facebook", id: "done" }, ...[1, 2, 3, 4].map(() => ({ ok: false, channel: "facebook", id: "tired" }))];
  const fb = m.waiting("facebook", { now, days: 2, igLedger: ig, cross }).map((e) => e.id);
  assert.deepEqual(fb, ["f1", "s1"]);
  const th = m.waiting("threads", { now, days: 2, igLedger: ig, cross }).map((e) => e.id);
  assert.deepEqual(th, ["done", "tired", "f1"]);
});

await check("a Facebook outage is recorded and does not throw; the next run sends it once; Threads is not held up", async () => {
  const ig = [entry("o1")];
  scenario = { fbDown: true };
  let out = await m.crosspostAll({ igLedger: ig, log: () => {} });
  assert.equal(out.failed, 1); assert.equal(out.sent, 1, "Threads still went out");
  assert.ok(m.crossLedger().some((e) => e.channel === "facebook" && e.id === "o1" && e.ok === false));
  scenario = {};
  out = await m.crosspostAll({ igLedger: ig, log: () => {} });
  assert.equal(out.sent, 1); assert.equal(out.failed, 0);
  out = await m.crosspostAll({ igLedger: ig, log: () => {} });
  assert.equal(out.sent, 0, "a third run sends nothing: published once");
});

await check("gives up after 4 failures and stops trying", async () => {
  scenario = { fbDown: true };
  for (let i = 0; i < 6; i++) await m.crosspostAll({ igLedger: [entry("g1")], log: () => {} });
  assert.equal(m.crossLedger().filter((e) => e.channel === "facebook" && e.id === "g1" && !e.ok).length, 4);
});

await check("a post that went out but was not recorded is found on the Page and not sent twice", async () => {
  const e = entry("d1");
  scenario = { already: `Some words\n\n${m.bookUrl("facebook", "d1")}` };
  const out = await m.crosspostAll({ igLedger: [e], log: () => {} });
  assert.ok(m.crossLedger().some((x) => x.channel === "facebook" && x.recovered === true && x.id === "d1"));
  assert.ok(!calls.some((c) => c.rec.endsWith("/PAGE/photos")), "no second photo post");
});

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
