// image.mjs — where a post's picture comes from, and the shape it ends up in.
//
// Two sources, in this order of preference:
//
//   library — a real photo of the real boat. 80+ of them exist across
//             site/social, klook-photos and clickandboat-sunset-photos. These
//             are always the better post: real light, real guests, real hull.
//
//   ai      — scenery and wildlife only (ocean, cliffs, sunsets, dolphins).
//             The AI is NEVER asked to draw the Chifbay boat. It gets the
//             details wrong every time — during testing it duplicated the gold
//             `Chifbay` script on the hull, and Gemini refused the subject
//             outright — and a wrong boat on a real business account is worse
//             than no post. Angles that show the boat, the crew or guests are
//             marked `ai_prompt: null` in brand.json and can only ever be
//             served from the library.
//
// Everything leaves here as a 1080x1350 JPEG. That is Instagram's 4:5 portrait,
// the ratio that takes the most vertical space in the feed, and it keeps us
// safely inside Meta's accepted 4:5 - 1.91:1 range so a tall or panoramic
// original can never be rejected at publish time.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { SITE_ROOT, config, sha256 } from "./queue.mjs";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

const AI_STYLE =
  "professional travel photography, natural light, sharp focus, editorial quality, " +
  "no text, no watermark, no logos, no faces";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- real photos -----------------------------------------------------------

/** Every usable source photo, as { path, origin } with origin repo-relative. */
export function libraryFiles() {
  const out = [];
  for (const dir of config.library_dirs) {
    const abs = join(SITE_ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!IMAGE_RE.test(f)) continue;
      out.push({ path: join(abs, f), origin: relative(SITE_ROOT, join(abs, f)) });
    }
  }
  return out.sort((a, b) => a.origin.localeCompare(b.origin));
}

/**
 * Pick a real photo that has not been used recently and has never been posted.
 * Returns null when the library is exhausted, which is a real state worth
 * reporting rather than papering over — the caller falls back to AI.
 */
export function pickFromLibrary({ excludeOrigins, excludeHashes }) {
  const candidates = libraryFiles().filter((f) => !excludeOrigins.has(f.origin));
  // Shuffled by content hash of the path so the order is stable per file but
  // not alphabetical — no Math.random, so a re-run picks the same thing.
  const shuffled = candidates
    .map((f) => ({ f, k: sha256(f.origin + new Date().toISOString().slice(0, 10)) }))
    .sort((a, b) => a.k.localeCompare(b.k))
    .map((x) => x.f);

  for (const cand of shuffled) {
    const buf = readFileSync(cand.path);
    if (excludeHashes.has(sha256(buf))) continue;
    return { buf, origin: cand.origin, source: "library" };
  }
  return null;
}

// --- generated scenery -----------------------------------------------------

async function pollinations(prompt, tries = 3) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, ${AI_STYLE}`)}`;
  const params = new URLSearchParams({
    model: "flux", width: "1080", height: "1350", nologo: "true",
    seed: String(Math.floor(Date.now() % 2 ** 31)),
  });
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(120_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && !(res.headers.get("content-type") ?? "").includes("json")) return buf;
    if (attempt === tries) throw new Error(`pollinations failed: ${buf.toString().slice(0, 200)}`);
    await sleep(10_000 * attempt); // free tier serialises per IP and 429s on "queue full"
  }
}

async function openaiImage(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-image-1", prompt: `${prompt}, ${AI_STYLE}`,
      size: "1024x1536", quality: "high", n: 1,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`openai images: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(json.data[0].b64_json, "base64");
}

/**
 * Scenery for an angle. Falls back to Pollinations if OpenAI is selected but
 * has no key, so a missing secret degrades the picture quality instead of
 * breaking the day's post.
 */
export async function generateAI(angle) {
  if (!angle.ai_prompt) throw new Error(`angle "${angle.key}" is library-only by design`);
  const wanted = config.ai_provider;
  if (wanted === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return { buf: await openaiImage(angle.ai_prompt), source: "ai", origin: `ai:openai:${angle.key}` };
    } catch (err) {
      console.warn(`openai image failed, falling back to pollinations: ${err.message}`);
    }
  }
  return { buf: await pollinations(angle.ai_prompt), source: "ai", origin: `ai:pollinations:${angle.key}` };
}

// --- output shape ----------------------------------------------------------

/** Cover-crop to Instagram 4:5 portrait, strip metadata, keep it under ~1 MB. */
export async function normalise(buf) {
  return sharp(buf)
    .rotate()                                        // honour EXIF orientation before cropping
    .resize(1080, 1350, { fit: "cover", position: "attention" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}
