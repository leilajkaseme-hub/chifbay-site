#!/usr/bin/env node
// crosspost.mjs — send the Instagram posts of the last days to the Facebook Page and to Threads.
//
//   node bin/crosspost.mjs                 feed posts and stories
//   CROSSPOST_KINDS=story node bin/crosspost.mjs
//   IG_TRANSPORT=dry-run node bin/crosspost.mjs    shows what would go, sends nothing
//
// Runs after bin/post.mjs in the same workflow job. It always exits 0 on a channel failure (the
// failure is in crosspost-ledger.jsonl and on the phone), so the Instagram job never goes red
// because Facebook or Threads had a bad minute.
import { crosspostAll } from "../lib/crosspost.mjs";

const kinds = (process.env.CROSSPOST_KINDS || "feed,story").split(",");
const dry = (process.env.IG_TRANSPORT || "") === "dry-run";
const r = await crosspostAll({ kinds, dry });
console.log(`CROSSPOST sent=${r.sent} failed=${r.failed} not-connected=${r.skipped.join("|") || "-"}`);
