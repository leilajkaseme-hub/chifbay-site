#!/usr/bin/env node
// test-publish.mjs — guards the two faults that stopped this account posting.
//
// Neither of them could be caught by reading the code, and neither showed up as
// a red run. They are exactly the kind of thing that comes back the next time
// someone edits publish.mjs, so they get a test:
//
//   1. Publishing before Meta has finished downloading the image.
//      Creating a container hands Meta a URL; Meta fetches it afterwards, on
//      its own servers. Publish too early and it fails with
//      "Media ID is not available" (9007 / 2207027). It is a race, so the code
//      looked correct and worked twice before failing every time after.
//
//   2. A failed post finishing green, because "node post.mjs | tee log" under
//      bash -e takes tee's exit code. The alert step is guarded by
//      if: failure(), so it never fired either.
//
// No network and no packages: fetch is replaced with a fake Meta that behaves
// the way the real one does. Run it with `node test-publish.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${err.message.split("\n")[0]}`);
  }
}

/**
 * A fake Meta. `readyAfter` is how many status polls it answers IN_PROGRESS
 * before it says FINISHED — that is the download the real API is doing.
 * media_publish refuses with the real 9007 until then, exactly as Meta does.
 */
function fakeMeta({ readyAfter = 1, containerFails = null, publishAlwaysEarly = false } = {}) {
  const calls = [];
  let polls = 0;
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? "GET";
    calls.push(`${method} ${path}`);
    const json = (body, status = 200) =>
      ({ ok: status < 400, status, json: async () => body });

    if (method === "POST" && path.endsWith("/media")) {
      if (containerFails) return json({ error: containerFails }, 400);
      return json({ id: "CONTAINER1" });
    }
    if (method === "GET" && path === "/v21.0/CONTAINER1") {
      polls++;
      return json({ status_code: polls > readyAfter ? "FINISHED" : "IN_PROGRESS" });
    }
    if (method === "POST" && path.endsWith("/media_publish")) {
      const early = publishAlwaysEarly || polls <= readyAfter;
      if (early) {
        return json({
          error: {
            message: "Media ID is not available",
            type: "OAuthException",
            code: 9007,
            error_subcode: 2207027,
            error_user_msg: "The media is not ready for publishing, please wait for a moment",
            fbtrace_id: "TRACE",
          },
        }, 400);
      }
      return json({ id: "MEDIA1" });
    }
    throw new Error(`unexpected call: ${method} ${path}`);
  };
  return calls;
}

const item = { kind: "story", url: "https://www.chifbay.com/ig/x.jpg", rendered_caption: "hi" };

// Imported once, after fetch is first replaced, because the module is cached.
fakeMeta();
process.env.IG_ACCESS_TOKEN = "test-token";
process.env.IG_USER_ID = "1784100";
process.env.IG_TRANSPORT = "graph";
const { publish } = await import("./lib/publish.mjs");

// --- 1. the race ------------------------------------------------------------

await check("waits for the container before publishing", async () => {
  const calls = fakeMeta({ readyAfter: 2 });
  const out = await publish(item);
  assert.equal(out.media_id, "MEDIA1");
  const firstPublish = calls.indexOf("POST /v21.0/1784100/media_publish");
  const lastPoll = calls.lastIndexOf("GET /v21.0/CONTAINER1");
  assert.ok(lastPoll !== -1, "never polled the container status at all");
  assert.ok(
    lastPoll < firstPublish,
    `published before the container was ready — calls were ${calls.join(", ")}`,
  );
});

await check("polls until FINISHED rather than a fixed number of times", async () => {
  const calls = fakeMeta({ readyAfter: 4 });
  await publish(item);
  const polls = calls.filter((c) => c === "GET /v21.0/CONTAINER1").length;
  assert.ok(polls >= 5, `gave up after ${polls} polls`);
});

await check("retries the SAME container, never builds a second one", async () => {
  // FINISHED but publish still refuses once — Meta really does this.
  const calls = fakeMeta({ readyAfter: 0 });
  let first = true;
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/media_publish") && first) {
      first = false;
      return {
        ok: false, status: 400,
        json: async () => ({ error: { message: "Media ID is not available", code: 9007, error_subcode: 2207027 } }),
      };
    }
    return inner(url, init);
  };
  await publish(item);
  const containers = calls.filter((c) => c === "POST /v21.0/1784100/media").length;
  assert.equal(containers, 1, "built a second container — that is a second download and the same race");
});

// --- 2. errors say what is wrong --------------------------------------------

await check("an image Instagram refuses stops at once, with its reason", async () => {
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if ((init.method ?? "GET") === "POST") return { ok: true, status: 200, json: async () => ({ id: "CONTAINER1" }) };
    return { ok: true, status: 200, json: async () => ({ status_code: "ERROR", status: "media download failed" }) };
  };
  await assert.rejects(publish(item), /refused the image \(ERROR\).*media download failed/s);
});

await check("Meta's code and subcode reach the log", async () => {
  fakeMeta({ containerFails: { message: "API access blocked.", code: 190, error_subcode: 492, type: "OAuthException", fbtrace_id: "ABC" } });
  await assert.rejects(publish(item), (err) => {
    assert.match(err.message, /API access blocked\./);
    assert.match(err.message, /code 190/);
    assert.match(err.message, /subcode 492/);
    assert.match(err.message, /fbtrace ABC/);
    return true;
  });
});

// --- 3. a failed post must fail the run -------------------------------------

await check("every workflow that pipes runs under pipefail", () => {
  // Without this, a failed post finishes green and the if: failure() alert
  // never fires. `shell: bash` is what makes Actions use -eo pipefail.
  for (const wf of ["post", "story", "heartbeat", "token-check", "topup", "whoami"]) {
    let text;
    try {
      text = readFileSync(new URL(`../.github/workflows/ig-auto-${wf}.yml`, import.meta.url), "utf8");
    } catch {
      continue; // that workflow does not exist, nothing to guard
    }
    if (!/\|\s*tee\b|\|\s*grep\b/.test(text)) continue;
    assert.match(
      text,
      /defaults:\s*\n\s*run:\s*\n\s*shell:\s*bash/,
      `ig-auto-${wf}.yml pipes but has no "defaults: run: shell: bash" — a failed post would go green`,
    );
  }
});

// ----------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} FAILED, ${passed} passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${passed} checks passed`);
