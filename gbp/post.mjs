#!/usr/bin/env node
// post.mjs: one "What's new" post on the main profile.
//
//   node gbp/post.mjs --journal      today's Journal article (scripts/gbp-draft.mjs), with a REAL trip photo
//   node gbp/post.mjs --file x.json  a post written by hand: {summary, url, photo, action}
//   add --dry to print it and send nothing
//
// The Journal heroes are AI pictures: on the profile only real photos of our trips go out (social-drive/, never the
// same photo twice). No long dashes (Theo's rule). One post a day at most.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, api, ledger, record, v4, where } from "./lib.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const SITE = join(ROOT, "..");
const today = new Date().toISOString().slice(0, 10);

function realPhoto() {
  const used = new Set(ledger().filter((e) => e.kind === "post").map((e) => e.photo));
  const excl = new Set(JSON.parse(readFileSync(join(SITE, "ig-auto", "config.json"), "utf8")).exclude ?? []);
  const all = readdirSync(join(SITE, "social-drive")).filter((f) => /\.jpe?g$/i.test(f) && !f.startsWith("00-") && !excl.has(`social-drive/${f}`));
  const pick = all.find((f) => !used.has(`https://chifbay.com/social-drive/${f}`)) ?? all[0];
  return `https://chifbay.com/social-drive/${pick}`;
}

const clean = (t) => t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();

async function main() {
  if (ledger().some((e) => e.kind === "post" && e.ok && e.at.slice(0, 10) === today) && !args.includes("--force")) {
    console.log("already posted today"); return;
  }
  let body;
  if (args.includes("--journal")) {
    const d = JSON.parse(execFileSync("node", [join(SITE, "scripts", "gbp-draft.mjs"), "--json"], { encoding: "utf8" }));
    if (!d.summary) { console.log("no Journal article today"); return; }
    body = { languageCode: "en", topicType: "STANDARD", summary: clean(d.summary), callToAction: d.callToAction,
             media: [{ mediaFormat: "PHOTO", sourceUrl: realPhoto() }] };
  } else if (args.includes("--file")) {
    const p = JSON.parse(readFileSync(args[args.indexOf("--file") + 1], "utf8"));
    body = { languageCode: "en", topicType: "STANDARD", summary: clean(p.summary),
             callToAction: { actionType: p.action ?? "BOOK", url: p.url ?? "https://chifbay.com/?utm_source=google&utm_medium=gbp_post" },
             media: [{ mediaFormat: "PHOTO", sourceUrl: p.photo ?? realPhoto() }] };
  } else { console.log("say --journal or --file"); return; }
  if (body.summary.length > 1500) body.summary = body.summary.slice(0, 1490).replace(/\s+\S*$/, "") + "…";
  console.log(JSON.stringify(body, null, 1));
  if (DRY) return;
  const at = await where();
  const out = await api("POST", v4(`${at.path}/localPosts`), body);
  record({ kind: "post", ok: true, name: out.name, url: out.searchUrl, photo: body.media[0].sourceUrl, summary: body.summary.slice(0, 120) });
  console.log(`posted: ${out.searchUrl ?? out.name}`);
}

main().catch((e) => { record({ kind: "post", ok: false, error: e.message.slice(0, 300) }); console.error(e.message); process.exit(1); });
