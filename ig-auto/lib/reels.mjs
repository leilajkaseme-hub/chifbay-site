// reels.mjs — turn a video from the Drive into short clips worth posting.
//
// Nobody picks the moments by hand. A video is measured every half second for
// light and colour, its cuts are found, and the best stretches that hold ONE
// shot are kept: bright but not blown out, saturated, and away from the first
// and last seconds, where edited videos carry title cards and thank-you text.
//
// The clips are committed to the public ig/ folder like every other picture,
// so by the time a Reel is posted GitHub Pages has long since deployed it.
// Their sound is removed: a video edited on a phone usually carries a licensed
// song, and a muted clip can never get the account a copyright strike.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE_ROOT, config } from "./queue.mjs";
import sharp from "sharp";

export const REELS_FILE = join(ROOT, "reels.json");
const CLIP = 8;          // seconds per clip
const MIN_CLIP = 6;      // a shorter clean stretch is still worth keeping
const EDGE_IN = 4;       // title cards live in the first seconds
const EDGE_OUT = 6;      // and thank-you cards in the last ones
const MAX_PER_VIDEO = 4;

export function loadReels() {
  try { return JSON.parse(readFileSync(REELS_FILE, "utf8")); } catch { return { clips: [] }; }
}
export function saveReels(r) { writeFileSync(REELS_FILE, JSON.stringify(r, null, 2) + "\n"); }

function probe(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:stream_tags=rotate:stream_side_data=rotation:format=duration",
    "-of", "json", file], { encoding: "utf8" });
  const j = JSON.parse(out);
  const s = j.streams?.[0] ?? {};
  let w = s.width, h = s.height;
  const rot = Math.abs(Number(s.tags?.rotate ?? s.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0));
  if (rot === 90 || rot === 270) [w, h] = [h, w];
  return { w, h, dur: Number(j.format?.duration ?? 0) };
}

/** Light and colour every half second, and the times of every cut. */
export function measure(file) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-an",
    "-vf", "fps=2,scale=160:-2,signalstats,metadata=print:file=-", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 });
  const samples = [];
  let cur = null;
  for (const line of (r.stdout || "").split("\n")) {
    const t = line.match(/pts_time:([\d.]+)/);
    if (t) { cur = { t: Number(t[1]) }; samples.push(cur); continue; }
    const kv = line.match(/lavfi\.signalstats\.(YAVG|SATAVG)=([\d.]+)/);
    if (kv && cur) cur[kv[1]] = Number(kv[2]);
  }
  const sc = spawnSync("ffmpeg", ["-nostdin", "-v", "info", "-i", file, "-an",
    "-vf", "scale=320:-2,select='gt(scene,0.3)',showinfo", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 });
  const cuts = [...(sc.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  return { samples, cuts };
}

/** How good one half-second looks. Colour counts most; light is a gate. */
function sampleScore(s) {
  const y = s.YAVG ?? 0, sat = s.SATAVG ?? 0;
  if (y < 45 || y > 215) return 0;                // too dark or blown out
  const light = 1 - Math.abs(y - 125) / 125;      // 1 at mid grey
  return sat * (0.6 + 0.4 * light);
}

/** The best non-overlapping single-shot windows, best first. Pure. */
export function pickWindows({ samples, cuts: sceneCuts }, dur, { clip = CLIP, max = MAX_PER_VIDEO } = {}) {
  const lo = Math.min(EDGE_IN, dur * 0.1), hi = dur - Math.min(EDGE_OUT, dur * 0.1);
  // Edited videos cross-fade between shots, which the scene filter misses. A
  // sharp jump in light or colour between two half-seconds is a cut too.
  const cuts = [...sceneCuts];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (Math.abs((b.YAVG ?? 0) - (a.YAVG ?? 0)) > 12 || Math.abs((b.SATAVG ?? 0) - (a.SATAVG ?? 0)) > 4) cuts.push(b.t);
  }
  cuts.sort((x, y) => x - y);
  // Corrupt frames and colour glitches look MORE saturated than anything real
  // in the same video (the 13 August file has a bright green stretch). Anything
  // far above the video's own median is refused, not rewarded.
  const sats = samples.map((x) => x.SATAVG ?? 0).sort((x, y) => x - y);
  const median = sats[Math.floor(sats.length / 2)] ?? 0;
  const glitch = (x) => (x.SATAVG ?? 0) > median * 1.8 + 2;
  const cands = [];
  for (let start = lo; start + MIN_CLIP <= hi; start += 0.5) {
    // Longest length up to `clip` that holds no cut.
    const nextCut = cuts.find((c) => c > start + 0.3);
    const len = Math.min(clip, hi - start, nextCut != null ? nextCut - start - 0.2 : clip);
    if (len < MIN_CLIP) continue;
    const inWin = samples.filter((s) => s.t >= start && s.t < start + len);
    if (inWin.length < len) continue;
    if (inWin.some(glitch)) continue;
    const scores = inWin.map(sampleScore);
    if (Math.min(...scores) === 0) continue;      // one dark frame spoils it
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    cands.push({ start: Math.round(start * 10) / 10, len: Math.round(len * 10) / 10, score: mean });
  }
  cands.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of cands) {
    if (out.length >= max) break;
    if (out.length && c.score < out[0].score * 0.6) break;   // only the good ones
    if (out.some((o) => c.start < o.start + o.len + 3 && o.start < c.start + c.len + 3)) continue;
    out.push(c);
  }
  return out;
}

/**
 * Where to put the crop. A centred crop cut the boat in half on the first
 * try, so the frame is read at the start, middle and end of the clip, libvips'
 * attention strategy finds the busiest part of each, and the crop sits on
 * their average. One position for the whole clip: a crop that follows the
 * subject would need tracking and wobbles.
 */
async function focusX(file, win, scaledW, scaledH, ow) {
  if (scaledW <= ow) return 0;
  const xs = [];
  for (const f of [0.15, 0.5, 0.85]) {
    const r = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-ss", String(win.start + win.len * f), "-i", file,
      "-frames:v", "1", "-vf", `scale=${scaledW}:${scaledH}`, "-f", "image2pipe", "-vcodec", "png", "-"],
      { maxBuffer: 1 << 27 });
    if (!r.stdout?.length) continue;
    const { info } = await sharp(r.stdout).resize(ow, scaledH, { fit: "cover", position: sharp.strategy.attention })
      .toBuffer({ resolveWithObject: true });
    if (Number.isFinite(info.attentionX)) xs.push(info.attentionX);
  }
  if (!xs.length) return Math.round((scaledW - ow) / 2);
  const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.max(0, Math.min(scaledW - ow, Math.round(mid - ow / 2)));
}

/**
 * Cut the clips. Portrait sources become 9:16, landscape ones 4:5: a 9:16 crop
 * of a drone shot keeps a third of the frame and usually loses the boat.
 */
export async function cutClips(file, key, { dryRun = false } = {}) {
  const { w, h, dur } = probe(file);
  if (!w || !h || dur < MIN_CLIP + 2) return [];
  const wins = pickWindows(measure(file), dur);
  const portrait = h > w;
  const [ow, oh] = portrait ? [1080, 1920] : [1080, 1350];
  // Scale so the height fits, then crop the width where the subject is.
  const scaledH = Math.round(Math.max(oh, (ow * h) / w) / 2) * 2;
  const scaledW = Math.round((w * scaledH) / h / 2) * 2;
  const pub = join(SITE_ROOT, config.public_dir);
  const out = [];
  for (const [i, win] of wins.entries()) {
    const base = `reel-${key}-${i + 1}`;
    const mp4 = join(pub, `${base}.mp4`), jpg = join(pub, `${base}.jpg`);
    const x = await focusX(file, win, scaledW, scaledH, ow);
    const vf = `scale=${scaledW}:${scaledH},crop=${ow}:${oh}:${x}:0,fps=30,format=yuv420p`;
    if (!dryRun) {
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", String(win.start), "-i", file,
        "-t", String(win.len), "-vf", vf, "-an", "-c:v", "libx264", "-profile:v", "high",
        "-crf", "22", "-preset", "slow", "-maxrate", "8M", "-bufsize", "16M",
        "-movflags", "+faststart", mp4]);
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", String(win.start + win.len / 2),
        "-i", file, "-frames:v", "1", "-vf", vf.replace(",fps=30,format=yuv420p", ""), "-q:v", "3", jpg]);
    }
    out.push({
      clip: `${config.public_dir}/${base}.mp4`,
      cover: `${config.public_dir}/${base}.jpg`,
      start: win.start, len: win.len, score: Math.round(win.score * 10) / 10,
      shape: portrait ? "9:16" : "4:5",
      bytes: dryRun ? 0 : statSync(mp4).size,
    });
  }
  return out;
}

export const hasFfmpeg = () => spawnSync("ffmpeg", ["-version"]).status === 0;
export const exists = (rel) => existsSync(join(SITE_ROOT, rel));
