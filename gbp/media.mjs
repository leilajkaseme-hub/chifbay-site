#!/usr/bin/env node
// media.mjs: add real photos and approved videos to the main profile (profiles with fresh photos get more calls and routes).
//
//   node gbp/media.mjs --photos 6        the next 6 library photos never sent to Google (social-drive/, real trips)
//   node gbp/media.mjs --videos          the short videos Theo approved on the review page, not yet on Google
//   node gbp/media.mjs --dry ...         say what would go, send nothing
//
// Google fetches each file itself from its public URL (chifbay.com for photos, the chifbay-media Worker for videos).
// Videos only when Theo said OK to that video (his rule, 17 Oct 2026). A few a day: a burst of uploads looks like spam.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, api, ledger, record, v4, where } from "./lib.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const nPhotos = args.includes("--photos") ? Number(args[args.indexOf("--photos") + 1] || 6) : 0;
const SITE = join(ROOT, "..");
const MEDIA = "https://chifbay-media.chifandcopt.workers.dev";

const sent = () => new Set(ledger().filter((e) => e.kind === "media" && e.ok).map((e) => e.source));

function photos(n) {
  const done = sent();
  const excl = new Set(JSON.parse(readFileSync(join(SITE, "ig-auto", "config.json"), "utf8")).exclude ?? []);
  return readdirSync(join(SITE, "social-drive"))
    .filter((f) => /\.jpe?g$/i.test(f) && !f.startsWith("00-") && !excl.has(`social-drive/${f}`))
    .map((f) => `https://chifbay.com/social-drive/${f}`)
    .filter((u) => !done.has(u))
    .slice(0, n);
}

async function approvedVideos() {
  const r = await fetch(`${MEDIA}/approvals`, { headers: { Authorization: `Bearer ${process.env.IG_SYNC_SECRET}`, "User-Agent": "chifbay-gbp/1.0" } });
  if (!r.ok) throw new Error(`approvals ${r.status}`);
  const dec = (await r.json()).decisions ?? {};
  const plan = JSON.parse(readFileSync(join(SITE, "shorts", "plan.json"), "utf8"));
  const done = sent();
  return plan.videos.filter((v) => dec[v.id]?.d === "ok" && v.status === "rendered" && v.render?.video && !done.has(v.render.video))
    .map((v) => ({ url: v.render.video, id: v.id, what: v.texts?.alt }));
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  if (args.includes("--daily") && ledger().some((e) => e.kind === "media" && e.ok && e.at.slice(0, 10) === today)) {
    console.log("photos already added today"); return;
  }
  const at = await where();
  const items = photos(nPhotos).map((url) => ({ url, format: "PHOTO" }));
  if (args.includes("--videos")) items.push(...(await approvedVideos()).map((v) => ({ url: v.url, format: "VIDEO", id: v.id })));
  if (!items.length) { console.log("nothing new to add"); return; }
  for (const it of items) {
    if (DRY) { console.log(`[dry] ${it.format} ${it.url}`); continue; }
    try {
      const out = await api("POST", v4(`${at.path}/media`), {
        mediaFormat: it.format, sourceUrl: it.url, locationAssociation: { category: it.format === "VIDEO" ? "ADDITIONAL" : "AT_WORK" },
      });
      record({ kind: "media", ok: true, source: it.url, format: it.format, video: it.id, name: out.name, google: out.googleUrl });
      console.log(`  ${it.format} added: ${it.url}`);
    } catch (e) {
      record({ kind: "media", ok: false, source: it.url, format: it.format, error: e.message.slice(0, 300) });
      console.log(`  ${it.format} refused: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
