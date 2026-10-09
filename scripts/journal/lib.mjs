// lib.mjs: the Journal queue, shared by fill.mjs (writes posts ahead), publish.mjs
// (puts one live a day) and the Mac mini's image job.
//
// Why a queue (Theo, 9 Oct 2026: "everyday blog posts, not every 2-4 days, no failure
// allowed"): the old job wrote the post on the day, with Claude. When Claude's weekly
// limit was reached the day had no post (22-23 Sep, 5-7 Oct), and on 3 Oct Claude wrote
// nothing and the run still went green. Now posts are written days ahead and the daily
// step only moves a finished post into place: no AI at publish time, nothing to run out.
//
// One queue item = one folder journal-queue/<slug>/:
//   meta.json    the posts.json entry, plus "written" (the date the HTML carries now),
//                "images" (three photo descriptions) and "queued" (when it entered)
//   post.draft   the article HTML. Not ".html", so the drafts folder is never served as a
//                page (robots.txt also keeps crawlers out of journal-queue/)
//   hero.jpg, inline-1.jpg, inline-2.jpg   ChatGPT photos, added later by the Mac mini
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const QUEUE = join(ROOT, "journal-queue");
export const POSTS_JSON = join(ROOT, "posts", "posts.json");
export const IMAGE_NAMES = ["hero", "inline-1", "inline-2"];

/** Today in Madeira, YYYY-MM-DD. The post date the reader sees. */
export function today(now = new Date()) {
  if (process.env.JOURNAL_TODAY) return process.env.JOURNAL_TODAY;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Atlantic/Madeira" }).format(now);
}

/** "8 October 2026", the form the article shows under its title. */
export function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `${d} ${month} ${y}`;
}

/** Queue items, oldest first. */
export function queueItems() {
  if (!existsSync(QUEUE)) return [];
  return readdirSync(QUEUE)
    .filter((n) => statSync(join(QUEUE, n)).isDirectory() && existsSync(join(QUEUE, n, "meta.json")))
    .map((slug) => {
      const dir = join(QUEUE, slug);
      const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
      const images = IMAGE_NAMES.every((n) => existsSync(join(dir, `${n}.jpg`)));
      return { slug, dir, meta, images };
    })
    .sort((a, b) => String(a.meta.queued).localeCompare(String(b.meta.queued)) || a.slug.localeCompare(b.slug));
}

export const readPosts = () => JSON.parse(readFileSync(POSTS_JSON, "utf8"));

export function ntfy(title, body, priority = "default") {
  return fetch("https://ntfy.sh/futurx-blog-alerts-544024878e", {
    method: "POST", body, headers: { Title: title, Priority: priority, Tags: "boat" },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
}
