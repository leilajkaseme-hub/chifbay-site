#!/usr/bin/env node
// regrade.mjs: rebuild the pictures of queued posts from their ORIGINALS.
//
//   node bin/regrade.mjs          every queued item
//   node bin/regrade.mjs <id>...  only these
//
// Use it after the look changes (look.json). It never grades a queued file: it
// goes back to the library original (`origin`), levels it, crops it and applies
// the current look once, then overwrites the public file and its hash. Captions
// and order are kept. Items whose original is gone are left alone and listed.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listQueue, publicDir, sha256, SITE_ROOT, writeItem, withLock, config } from "../lib/queue.mjs";
import { normalise } from "../lib/image.mjs";
import { applyGrade } from "../lib/grade.mjs";
import { applyLook } from "../lib/look.mjs";
import { writeManifest } from "../lib/manifest.mjs";

const only = new Set(process.argv.slice(2));

async function render(origin, kind) {
  const abs = join(SITE_ROOT, origin);
  if (!existsSync(abs)) return null;
  return applyLook(await normalise(await applyGrade(abs), kind === "story" ? "story" : "feed"));
}

await withLock(async () => {
  const missing = [];
  for (const item of listQueue()) {
    if (only.size && !only.has(item.id)) continue;
    if (item.media === "video") continue;
    const kind = item.kind ?? "feed";
    const parts = item.slides?.length ? item.slides : [item];
    let done = 0;
    for (const part of parts) {
      const buf = await render(part.origin, kind);
      if (!buf) { missing.push(`${item.id}: ${part.origin}`); continue; }
      writeFileSync(join(publicDir, part.image.replace(`${config.public_dir}/`, "")), buf);
      part.sha256 = sha256(buf);
      done++;
    }
    if (item.slides?.length) { item.url = item.slides[0].url; item.sha256 = item.slides[0].sha256; item.image = item.slides[0].image; }
    item.look = (await import("../lib/look.mjs")).LOOK.version;
    writeItem(item);
    console.log(`${item.id} (${kind}): ${done}/${parts.length} rebuilt`);
  }
  writeManifest();
  if (missing.length) console.log(`original missing, left as is:\n  ${missing.join("\n  ")}`);
});
