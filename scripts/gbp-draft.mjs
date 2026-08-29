#!/usr/bin/env node
// gbp-draft.mjs — write today's Google Business Profile post, ready to paste.
//
// WHY THIS IS NOT AN API CALL
//
// Posting to a Business Profile needs the Business Profile API, and that API
// is gated twice over:
//
//   1. Access is granted by application, in days to weeks, and Google's own
//      guidance points it at agencies, tool vendors and businesses with ten or
//      more locations. Chifbay is one boat. A single-location owner is told to
//      use the dashboard.
//   2. It refuses service accounts. It needs OAuth as the profile owner and a
//      stored refresh token — another long-lived credential to keep safe, for
//      one post a day.
//
// So this does the part that can honestly be automated: it writes the post.
// Choosing the words, the length, the photo and the link is all of the work.
// Pasting it is fifteen seconds, on a channel that stays inside Google's rules
// and risks nothing.
//
// Driving the dashboard with a headless browser was the other option and is a
// bad trade: it breaks Google's terms with the account that holds the profile,
// and that profile is the single biggest local-search asset Chifbay owns.
//
// If API access is ever granted, --json already emits exactly the fields a
// localPosts call takes, so only the transport has to be written.
//
// Usage:
//   node scripts/gbp-draft.mjs           human-readable, for the terminal
//   node scripts/gbp-draft.mjs --json    machine-readable
//   node scripts/gbp-draft.mjs --any-age ignore the "is it today's post" check
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://chifbay.com";

// Google truncates a local post at 1500 characters, and shows roughly the
// first 150 before a "Read more". So the first sentence has to carry it.
const MAX = 1500;
const PREVIEW = 150;

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const anyAge = args.has("--any-age");

const posts = JSON.parse(readFileSync(join(ROOT, "posts/posts.json"), "utf8"));
if (!posts.length) {
  console.error("posts/posts.json is empty — nothing to draft");
  process.exit(1);
}

const post = posts[0];
const ageDays = Math.floor(
  (Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) -
   Date.parse(`${post.date}T00:00:00Z`)) / 86_400_000,
);

// Silence beats a stale draft. If the Journal did not publish, saying nothing
// is right: a post recycled from three days ago is worse than no post, and it
// would also hide the fact that blog-auto is broken.
if (ageDays > 1 && !anyAge) {
  console.log(`newest article is ${ageDays} days old (${post.date}) — no draft today`);
  console.log("blog-auto has probably not run; that is the thing to look at");
  process.exit(0);
}

const url = `${SITE}/posts/${post.slug}.html`;
const image = post.heroImage
  ? (post.heroImage.startsWith("http") ? post.heroImage : `${SITE}/${post.heroImage.replace(/^\//, "")}`)
  : null;

/** Google shows ~150 characters before "Read more", so the hook must fit in
 *  them whole. Cutting mid-word there reads as broken, not as truncated. */
function hook(text) {
  if (text.length <= PREVIEW) return text;
  const cut = text.slice(0, PREVIEW);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

const body = [
  post.description,
  "",
  "We run small private boat trips from Funchal — one group at a time, no sharing with strangers.",
].join("\n");

const summary = body.length > MAX ? body.slice(0, MAX - 1) + "…" : body;

const draft = {
  date: new Date().toISOString().slice(0, 10),
  article: { title: post.title, slug: post.slug, date: post.date },
  // The shape a localPosts.create call takes, so nothing has to be re-derived
  // if the API is ever opened up.
  topicType: "STANDARD",
  languageCode: "en",
  summary,
  callToAction: { actionType: "LEARN_MORE", url },
  media: image ? [{ mediaFormat: "PHOTO", sourceUrl: image }] : [],
  preview: hook(summary),
  characters: summary.length,
};

if (asJson) {
  console.log(JSON.stringify(draft, null, 2));
} else {
  console.log(`Google Business Profile — post for ${draft.date}`);
  console.log(`from the Journal article of ${post.date}: ${post.title}\n`);
  console.log(`${draft.characters}/${MAX} characters. Shown before "Read more":`);
  console.log(`  ${draft.preview}\n`);
  console.log("--- paste this as the post text ---");
  console.log(summary);
  console.log("--- button: Learn more -> ---");
  console.log(url);
  if (image) {
    console.log("--- photo ---");
    console.log(image);
  } else {
    console.log("--- photo: none on this article, pick one in the dashboard ---");
  }
}
