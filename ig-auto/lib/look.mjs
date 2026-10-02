// look.mjs: the Chifbay "Atlantic" look on every photo the robot queues.
//
// Since the audit of 2 Oct 2026: no grain, and three presets instead of one
// filter, chosen by measuring the photo (look.json "presets"):
//   golden     warm low sun: keeps skin warm, holds the highlights
//   overcast   grey day: a little colour and contrast back, never orange
//   daylight   everything else: blue sea, clean whites
// The same presets grade the Reels (stores/chifbay/reels/make.py), so photos and
// Reels read as one account. The grade runs ONCE, on the original from the
// library, after the exposure leveller (grade.mjs). A queued file is never
// graded again: to change the look, delete the queue item and let top-up
// rebuild it from the original.
// On GitHub (CI set) a missing ffmpeg is an error: a feed where half the posts
// have the look and half do not is worse than a late top-up. On the Mac it
// only warns, so local previews still work without ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./queue.mjs";
import { measure } from "./palette.mjs";

export const LOOK = JSON.parse(readFileSync(join(ROOT, "look.json"), "utf-8"));

/** Which preset a photo gets, from palette.measure(). Pure, so it is testable. */
export function presetFor(m) {
  if (m.b > 15 && m.hue > 25 && m.hue < 110) return "golden";
  if (m.chroma < 9) return "overcast";
  return "daylight";
}

export async function applyLook(jpeg) {
  const dir = mkdtempSync(join(tmpdir(), "look-"));
  try {
    const kind = presetFor(await measure(jpeg));
    const src = join(dir, "in.jpg");
    const out = join(dir, "out.jpg");
    writeFileSync(src, jpeg);
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, "-vf", LOOK.presets[kind],
      "-q:v", "2", "-map_metadata", "-1", out], { stdio: ["ignore", "ignore", "pipe"] });
    console.log(`  look: ${kind}`);
    return readFileSync(out);
  } catch (err) {
    if (process.env.CI) throw new Error(`the ${LOOK.name} look could not be applied: ${err.message}`);
    console.warn(`look not applied (${err.message.split("\n")[0]}), photo kept as is`);
    return jpeg;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
