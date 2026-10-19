// test-sources.mjs: the same source video is never planned again within SOURCE_DAYS.
//   node test-sources.mjs
import assert from "node:assert/strict";
import { recentSources } from "./lib/sources.mjs";

const NOW = Date.parse("2026-10-19T12:00:00Z"), DAY = 86_400_000;
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log("  ok  ", name); };

const reels = { clips: [
  { clip: "ig/a-1.mp4", source: "video 2.MP4", used: { story: NOW - 2 * DAY } },
  { clip: "ig/a-2.mp4", source: "video 2.MP4" },
  { clip: "ig/b-1.mp4", source: "old.MP4", used: { story: NOW - 90 * DAY } },
  { clip: "ig/c-1.mp4", source: "fresh.MP4" },
] };
const plan = { reels: [{ id: "r01", shots: [{ file: "Video 1080P.mp4" }, { file: "Video 1080P.mp4" }] }, { id: "r09", shots: [{ file: "never.MOV" }] }] };
const ledger = [
  { ok: true, source: "reel", id: "r01", at: "2026-10-05T10:00:00Z" },
  { ok: false, source: "reel", id: "r09", at: "2026-10-18T10:00:00Z" },
  { ok: true, source: "library", id: "x", at: "2026-10-18T10:00:00Z" },
];
const got = recentSources({ reels, plan, ledger, now: NOW });

t("one clip of a video rests the whole video", () => assert.ok(got.has("video 2.MP4")));
t("a video used 90 days ago is free again", () => assert.ok(!got.has("old.MP4")));
t("a video nobody used is free", () => assert.ok(!got.has("fresh.MP4")));
t("the shots of a Reel that went out rest", () => assert.ok(got.has("Video 1080P.mp4")));
t("a Reel that failed to post does not rest its footage", () => assert.ok(!got.has("never.MOV")));
t("an old Reel is free after the window", () => assert.ok(!recentSources({ reels: { clips: [] }, plan, ledger, now: NOW + 80 * DAY }).has("Video 1080P.mp4")));
console.log(`${ok} passed`);
