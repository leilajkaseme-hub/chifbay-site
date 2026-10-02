// manifest.mjs: the list of everything that could go to Instagram next.
//
// The portal's Instagram page reads it (https://chifbay.com/ig-auto/manifest.json)
// to show Theo the candidates: the Reels made from client footage
// (reels-plan.json, built on the Mac by stores/chifbay/reels/make.py), the
// carousels and the stories waiting in queue/. Nothing here decides what posts;
// Theo's approvals on the portal do.
//
// Written by top-up and after every post, so it never lists something that
// already went out.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listQueue } from "./queue.mjs";
import { slideUrls } from "./publish.mjs";

const PLAN = join(ROOT, "reels-plan.json");
const OUT = join(ROOT, "manifest.json");

/** Same host for every media file, so the page needs one rule, not two. */
const bare = (u) => (u ? String(u).replace("://www.chifbay.com/", "://chifbay.com/") : u);

export function buildManifest() {
  const reels = existsSync(PLAN) ? JSON.parse(readFileSync(PLAN, "utf-8")).reels ?? [] : [];
  const items = reels.map((r) => ({
    id: r.id, kind: "reel", media: "video", hook: r.hook, caption: r.caption,
    hashtags: r.hashtags ?? [], duration: r.duration,
    video: bare(r.video), preview: bare(r.preview), cover: bare(r.cover),
    colour: r.colour ?? null, note: r.note ?? "",
  }));
  for (const q of listQueue()) {
    const kind = (q.kind ?? "feed") === "story" ? "story" : "feed";
    const video = q.media === "video";
    items.push({
      id: q.id, kind, media: video ? "video" : "photo",
      caption: kind === "feed" ? q.caption ?? "" : "",
      hashtags: q.hashtags ?? [],
      cover: bare(video ? q.url.replace(/\.mp4$/, ".jpg") : q.url),
      video: video ? bare(q.url) : null,
      slides: video ? [] : slideUrls(q).map(bare),
      plan_index: Number.isFinite(q.plan_index) ? q.plan_index : null,
      created: q.created,
    });
  }
  return { generated_at: new Date().toISOString(), items };
}

export function writeManifest() {
  const m = buildManifest();
  writeFileSync(OUT, JSON.stringify(m, null, 1) + "\n");
  return m;
}
