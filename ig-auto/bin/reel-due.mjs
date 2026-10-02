#!/usr/bin/env node
// reel-due.mjs: tell Theo's phone when an approved Reel is due.
//
// Reels are the one thing the robot does not post: Instagram does not let code
// add a song from its music library, and a trending song is worth the 30
// seconds. So on the Reel's day this sends a notification with the video and
// the caption; tapping it opens the portal page with the download and copy
// buttons. It repeats every day until Theo marks the Reel "posted" there.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, today } from "../lib/queue.mjs";
import { readPlan } from "../lib/approval.mjs";
import { task } from "../lib/notify.mjs";

const PORTAL = "https://chifbay-booking-api.chifandcopt.workers.dev/portal/instagram";
const planFile = join(ROOT, "reels-plan.json");
const reels = existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf-8")).reels ?? [] : [];

let plan;
try {
  plan = await readPlan();
} catch (err) {
  console.error(`approval list unreadable: ${err.message}`);
  process.exit(1);
}

const day = today();
const due = reels.filter((r) => {
  const a = plan.approved.get(r.id);
  return a && a.kind === "reel" && a.day <= day && !plan.posted.has(r.id);
});
if (!due.length) {
  console.log(`no Reel due on ${day}`);
  process.exit(0);
}
for (const r of due) {
  const late = plan.approved.get(r.id).day < day ? " (en retard)" : "";
  const caption = [r.caption, (r.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
  console.log(`due: ${r.id}${late}`);
  await task(`Reel a poster${late}: ${r.hook}`,
    `Ajoute un son tendance dans Instagram, puis colle la legende:\n\n${caption}`,
    { click: PORTAL, attach: r.video });
}
