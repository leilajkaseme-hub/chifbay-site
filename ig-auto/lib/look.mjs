// look.mjs: the Chifbay "Atlantic" look on every photo the robot queues.
//
// Same ffmpeg filter as the Reels (look.json), so photos and Reels read as one
// account: gold leaning highlights that roll off, navy shadows, film blacks.
// On GitHub (CI set) a missing ffmpeg is an error: a feed where half the posts
// have the look and half do not is worse than a late top-up. On the Mac it
// only warns, so local previews still work without ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./queue.mjs";

export const LOOK = JSON.parse(readFileSync(join(ROOT, "look.json"), "utf-8"));

const PHOTO_CHAIN = LOOK.ffmpeg + (LOOK.grain_photo ? `,noise=alls=${LOOK.grain_photo}:allf=u` : "");

export function applyLook(jpeg, { grainOnly = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "look-"));
  try {
    const src = join(dir, "in.jpg");
    const out = join(dir, "out.jpg");
    writeFileSync(src, jpeg);
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, "-vf", grainOnly ? `noise=alls=${LOOK.grain_photo}:allf=u` : PHOTO_CHAIN,
      "-q:v", "2", "-map_metadata", "-1", out], { stdio: ["ignore", "ignore", "pipe"] });
    return readFileSync(out);
  } catch (err) {
    if (process.env.CI) throw new Error(`the ${LOOK.name} look could not be applied: ${err.message}`);
    console.warn(`look not applied (${err.message.split("\n")[0]}), photo kept as is`);
    return jpeg;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
