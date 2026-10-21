// test-shorts.mjs: the slot clock and the choice of the next video (no network).
import assert from "node:assert/strict";
import { dueSlot, nextVideo } from "./bin/shorts-post.mjs";

const at = (iso) => new Date(iso);
// Madeira is UTC+1 in summer (until 25 Oct 2026), UTC+0 in winter. Slots 11:30 and 19:30 +/- 20 min.
assert.equal(dueSlot(at("2026-11-02T08:00:00Z"), []), null, "too early: nothing due");
assert.equal(dueSlot(at("2026-11-02T12:00:00Z"), []), "2026-11-02#0", "morning slot due at noon");
assert.equal(dueSlot(at("2026-11-02T12:00:00Z"), [{ slot: "2026-11-02#0", ok: true }]), null, "filled slot is not due again");
assert.equal(dueSlot(at("2026-11-02T20:10:00Z"), [{ slot: "2026-11-02#0", ok: true }]), "2026-11-02#1", "evening slot");

const v = (id, names, extra = {}) => ({ id, status: "rendered", render: { checks: { ok: true } }, shots: names.map((name) => ({ name })), ...extra });
const plan = { videos: [
  v("s001", ["A"], { posted: { instagram: { at: "2026-11-01T11:30:00Z" } } }),
  v("s002", ["B"], { posted: { instagram: { at: "2026-11-01T19:30:00Z" } } }),
  v("s003", ["A", "C"]), v("s004", ["D"]), v("s005", ["E"]),
] };
const ok = { s003: { d: "ok" }, s004: { d: "ok" }, s005: { d: "no" } };
assert.equal(nextVideo(plan, ok).id, "s004", "skips a video that reuses a file of the last two posts");
assert.equal(nextVideo(plan, { s005: { d: "no" } }), null, "nothing approved: nothing goes out");
assert.equal(nextVideo({ videos: [v("s009", ["A"], { render: { checks: { ok: false } } })] }, { s009: { d: "ok" } }), null, "failed checks never go out");
assert.equal(nextVideo(plan, ok, new Set(["s004"])).id, "s003", "an id the Instagram robot already posted is never posted again");
console.log("shorts: 8 checks passed");
