#!/usr/bin/env node
// test-auto.mjs: the autonomous robot, run for real against a fake Instagram.
//
// Each case copies ig-auto into a temp folder, gives it a scenario, and runs
// the real bin/post.mjs (or bin/heartbeat.mjs) in a child process. fetch is
// replaced before the script starts (test-fake-fetch.mjs), so the code under
// test is exactly what runs on GitHub. Covers the audit's list: duplicate
// workers, timeout after publish, token expiry, bad media URL, empty queue,
// restart, pause, veto, missed-job alert.
//
//   node test-auto.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
let passed = 0;
const failures = [];

const REEL = (id, extra = {}) => ({
  id, kind: "reel", format: "action", version: "v2", subject: "jump",
  caption: `Caption of ${id}`, hashtags: ["#madeira", "#funchal", "#boattrip"],
  video: `https://chifbay.com/ig/reels/${id}.mp4`, clean_cover: `https://chifbay.com/ig/reels/${id}-cover.jpg`,
  checks: { ok: true, problems: [], at: "2026-10-02T20:00:00" }, ...extra,
});

/** A temp copy of ig-auto with an empty history and the given reels. */
function sandbox({ reels = [REEL("r15-daytrip"), REEL("r01-jump")], queue = [], state = {}, pauseFile = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "igauto-"));
  for (const f of ["bin", "lib", "config.json", "brand.json", "look.json", "package.json", "test-fake-fetch.mjs"]) {
    cpSync(join(HERE, f), join(dir, f), { recursive: true });
  }
  if (existsSync(join(HERE, "node_modules"))) symlinkSync(join(HERE, "node_modules"), join(dir, "node_modules"));
  mkdirSync(join(dir, "queue")); mkdirSync(join(dir, "posted"));
  writeFileSync(join(dir, "ledger.jsonl"), "");
  writeFileSync(join(dir, "state.json"), JSON.stringify(state));
  writeFileSync(join(dir, "reels-plan.json"), JSON.stringify({ version: "v2", reels }));
  for (const q of queue) writeFileSync(join(dir, "queue", `${q.id}.json`), JSON.stringify(q));
  if (pauseFile) writeFileSync(join(dir, "PAUSE"), "stopped by hand");
  return dir;
}

function run(dir, script, scenario, env = {}) {
  if (!scenario.slow) rmSync(join(dir, "fake.log"), { force: true }); // calls of this run only
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "./test-fake-fetch.mjs", script], {
      cwd: dir,
      env: {
        ...process.env, IG_TEST_FAST: "1", IG_NO_JITTER: "1", IG_TRANSPORT: "graph",
        IG_ACCESS_TOKEN: "TEST", IG_USER_ID: "1784", IG_TODAY: "2026-10-05", // a Monday: Reel day
        FAKE_SCENARIO: JSON.stringify(scenario), FAKE_LOG: join(dir, "fake.log"), ...env,
      },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      const log = existsSync(join(dir, "fake.log")) ? readFileSync(join(dir, "fake.log"), "utf-8").trim().split("\n").filter(Boolean) : [];
      const ledger = readFileSync(join(dir, "ledger.jsonl"), "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      resolve({ code, out, calls: log, ledger });
    });
  });
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length;

async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failures.push(name); console.log(`  FAIL ${name}\n       ${err.message.split("\n")[0]}`); }
}

console.log("autonomous robot, against a fake Instagram");

await check("a Reel day publishes the first qualified Reel, with its clean cover, once, and reads it back", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", {});
  assert.equal(r.code, 0, r.out);
  assert.equal(count(r.calls, /POST \/v21\.0\/1784\/media$/), 1);
  const body = r.calls.find((c) => c.startsWith("BODY "));
  assert.match(body, /"media_type":"REELS"/);
  assert.match(body, /r15-daytrip-cover\.jpg/);
  assert.equal(count(r.calls, /media_publish/), 1);
  const e = r.ledger.at(-1);
  assert.equal(e.ok, true); assert.equal(e.id, "r15-daytrip");
  assert.equal(e.permalink, "https://www.instagram.com/reel/FAKE/");
  rmSync(dir, { recursive: true });
});

await check("restart: a second run the same day posts nothing, the next Reel day takes the next Reel", async () => {
  const dir = sandbox();
  await run(dir, "bin/post.mjs", {});
  const again = await run(dir, "bin/post.mjs", {});
  assert.equal(count(again.calls, /media_publish/), 0);
  const wed = await run(dir, "bin/post.mjs", {}, { IG_TODAY: "2026-10-07" });
  assert.equal(wed.ledger.filter((e) => e.ok).map((e) => e.id).join(), "r15-daytrip,r01-jump");
  rmSync(dir, { recursive: true });
});

await check("pause from the portal: nothing is published", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { paused: true });
  assert.equal(count(r.calls, /\/media/), 0);
  assert.match(r.out, /PAUSED/);
  rmSync(dir, { recursive: true });
});

await check("PAUSE file: nothing is published, the portal is not even needed", async () => {
  const dir = sandbox({ pauseFile: true });
  const r = await run(dir, "bin/post.mjs", { approvalsDown: true });
  assert.equal(count(r.calls, /\/media/), 0);
  assert.match(r.out, /PAUSED/);
  rmSync(dir, { recursive: true });
});

await check("pause and vetoes unreadable: fails closed and alerts", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { approvalsDown: true });
  assert.equal(count(r.calls, /\/media/), 0);
  assert.equal(count(r.calls, /ntfy/), 1);
  rmSync(dir, { recursive: true });
});

await check("a vetoed Reel is skipped, the next one goes", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { skipped: ["r15-daytrip"] });
  assert.equal(r.ledger.at(-1).id, "r01-jump");
  rmSync(dir, { recursive: true });
});

await check("a Reel that failed its checks, or a test format, never goes", async () => {
  const dir = sandbox({ reels: [REEL("r16-split", { test: true }), REEL("r99-bad", { checks: { ok: false, problems: ["black frames"] } })] });
  const r = await run(dir, "bin/post.mjs", {});
  assert.equal(count(r.calls, /media_publish/), 0);
  assert.match(r.out, /nothing qualified/);
  rmSync(dir, { recursive: true });
});

await check("empty: nothing qualified on a Reel day posts no filler and alerts", async () => {
  const dir = sandbox({ reels: [] });
  const r = await run(dir, "bin/post.mjs", {});
  assert.equal(count(r.calls, /\/media/), 0);
  assert.equal(count(r.calls, /ntfy/), 1);
  rmSync(dir, { recursive: true });
});

await check("Sunday is a rest day: nothing, and no alert", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", {}, { IG_TODAY: "2026-10-04" });
  assert.equal(count(r.calls, /\/media|ntfy/), 0);
  rmSync(dir, { recursive: true });
});

await check("timeout after publish: Instagram posted it anyway, no second post", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { publishTimesOutButPosts: true });
  assert.equal(r.code, 0, r.out);
  assert.equal(count(r.calls, /media_publish/), 1);
  assert.equal(r.ledger.at(-1).ok, true);
  assert.equal(r.ledger.at(-1).recovered, true);
  rmSync(dir, { recursive: true });
});

await check("token expired: one attempt, failure recorded, Reel stays for tomorrow", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { tokenExpired: true });
  assert.notEqual(r.code, 0);
  assert.equal(count(r.calls, /POST \/v21\.0\/1784\/media$/), 1);
  assert.equal(r.ledger.at(-1).ok, false);
  const next = await run(dir, "bin/post.mjs", {}, { IG_TODAY: "2026-10-07" });
  assert.equal(next.ledger.at(-1).id, "r15-daytrip");
  rmSync(dir, { recursive: true });
});

await check("bad media URL: refused before Instagram is called", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { deadMedia: true });
  assert.notEqual(r.code, 0);
  assert.equal(count(r.calls, /\/v21\.0\//), 0);
  assert.match(r.ledger.at(-1).error, /not reachable/);
  rmSync(dir, { recursive: true });
});

await check("Instagram refuses the file (incomplete upload): failure, no publish call", async () => {
  const dir = sandbox();
  const r = await run(dir, "bin/post.mjs", { containerError: true });
  assert.notEqual(r.code, 0);
  assert.equal(count(r.calls, /media_publish/), 0);
  rmSync(dir, { recursive: true });
});

await check("duplicate workers started together: exactly one post", async () => {
  const dir = sandbox();
  const [a, b] = await Promise.all([run(dir, "bin/post.mjs", { slow: true }), run(dir, "bin/post.mjs", { slow: true })]);
  const ledger = readFileSync(join(dir, "ledger.jsonl"), "utf-8").trim().split("\n").filter(Boolean);
  assert.equal(ledger.length, 1);
  assert.ok(/lock/.test(a.out + b.out), "the second worker should stop on the lock");
  rmSync(dir, { recursive: true });
});

await check("missed job: the heartbeat alerts when no feed post for 3 days", async () => {
  const old = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const dir = sandbox({ state: { last_post_date: "2026-10-02", last_story_date: "2026-10-05" } });
  writeFileSync(join(dir, "ledger.jsonl"),
    JSON.stringify({ ok: true, kind: "feed", id: "x", at: old, confirmed: true }) + "\n" +
    JSON.stringify({ ok: true, kind: "story", id: "y", at: new Date().toISOString(), confirmed: true }) + "\n");
  const r = await run(dir, "bin/heartbeat.mjs", {});
  assert.notEqual(r.code, 0);
  assert.match(r.out, /no feed post for 7\d hours/);
  rmSync(dir, { recursive: true });
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
