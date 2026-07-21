#!/usr/bin/env node
// gen-post-images.mjs — generate a hero + 2 inline AI images for today's new
// Journal post (posts.json[0], just written by the Claude generation step)
// via Pollinations (free, no API key), and wire them into the post HTML +
// posts.json. Best-effort: on any failure, leaves the static manifest-picked
// image already chosen by Claude untouched and exits 0 (never blocks the run).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_JSON = join(ROOT, "posts", "posts.json");

// Kept deliberately generic — Journal topics span far beyond boat trips
// (rallies, hiking, food, festivals), so the style must not force boat/
// charter imagery onto unrelated subjects. The post's own title/description
// already carries the specific subject matter into the prompt.
const STYLE = "professional travel photography, Madeira Portugal, natural " +
  "lighting, sharp focus, editorial quality, no text, no watermark, no logos";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genImage(prompt, width, height, tries = 3) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, ${STYLE}`)}`;
  const params = new URLSearchParams({
    model: "flux", width, height, nologo: "true",
    seed: String(Math.floor(Math.random() * 2 ** 31)),
  });
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(120_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const ctype = res.headers.get("content-type") ?? "";
    if (res.ok && !ctype.includes("json")) return buf;
    if (attempt === tries) throw new Error(`pollinations failed: ${buf.toString().slice(0, 200)}`);
    await sleep(10_000 * attempt); // free tier: back off on "queue full" 429s
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function inlineFigureHtml(src, alt) {
  return `\n      <figure style="margin:36px 0;text-align:center">
        <img src="${src}" alt="${esc(alt)}" loading="lazy" style="width:100%;height:auto;border-radius:8px;display:block"/>
        <figcaption style="font-family:'Space Mono',monospace;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:10px">${esc(alt)}</figcaption>
      </figure>\n`;
}

async function main() {
  const posts = JSON.parse(readFileSync(POSTS_JSON, "utf-8"));
  const post = posts[0];
  if (!post?.slug) throw new Error("posts.json[0] has no slug — nothing to do");

  const postPath = join(ROOT, "posts", `${post.slug}.html`);
  if (!existsSync(postPath)) throw new Error(`post file not found: ${postPath}`);

  const title = post.title ?? post.slug;
  const desc = post.description ?? "";

  const heroPrompt = `${title} — ${desc}`.slice(0, 400);
  const inline1Prompt = `wide establishing shot related to: ${title}`.slice(0, 400);
  const inline2Prompt = `close-up detail scene related to: ${title}`.slice(0, 400);

  const journalDir = join(ROOT, "assets", "journal");
  mkdirSync(journalDir, { recursive: true });

  const heroRel = `assets/journal/${post.slug}-hero.jpg`;
  const inline1Rel = `assets/journal/${post.slug}-inline-1.jpg`;
  const inline2Rel = `assets/journal/${post.slug}-inline-2.jpg`;

  // Pollinations' free anonymous tier serializes to 1 request at a time per
  // IP (extra concurrent requests get rejected with 429 "Queue full") — so
  // these must run sequentially, not via Promise.all.
  const heroBuf = await genImage(heroPrompt, 1600, 900);
  writeFileSync(join(ROOT, heroRel), heroBuf);
  await sleep(2000);
  const inline1Buf = await genImage(inline1Prompt, 1200, 800);
  writeFileSync(join(ROOT, inline1Rel), inline1Buf);
  await sleep(2000);
  const inline2Buf = await genImage(inline2Prompt, 1200, 800);
  writeFileSync(join(ROOT, inline2Rel), inline2Buf);

  // --- update posts.json ----------------------------------------------------
  post.heroImage = heroRel;
  post.heroAlt = `${title} — Chifbay Journal`;
  writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2) + "\n");

  // --- update the post HTML --------------------------------------------------
  let html = readFileSync(postPath, "utf-8");
  const heroUrl = `../${heroRel}`;
  const heroUrlAbs = `https://chifbay.com/${heroRel}`;

  html = html.replace(/background-image:url\('[^']*'\)/, `background-image:url('${heroUrl}')`);
  html = html.replace(/(property="og:image" content=")[^"]*(")/, `$1${heroUrlAbs}$2`);
  html = html.replace(/("image":")[^"]*(")/, `$1${heroUrlAbs}$2`);

  const inlineHtml = [
    inlineFigureHtml(`../${inline1Rel}`, `${title} — detail`),
    inlineFigureHtml(`../${inline2Rel}`, `${title} — on board`),
  ];
  const paraEnds = [...html.matchAll(/<\/p>/g)].map((m) => m.index + m[0].length);
  if (paraEnds.length >= 2) {
    const spots = [paraEnds[Math.min(1, paraEnds.length - 1)]];
    if (paraEnds.length > 3) spots.push(paraEnds[Math.floor((paraEnds.length * 2) / 3)]);
    const inserts = spots.slice(0, 2).map((pos, i) => [pos, inlineHtml[i]]).sort((a, b) => b[0] - a[0]);
    for (const [pos, frag] of inserts) html = html.slice(0, pos) + frag + html.slice(pos);
  }

  writeFileSync(postPath, html);
  console.log(`OK: AI hero + ${inlineHtml.length} inline image(s) generated for "${title}" (${post.slug})`);
}

main().catch((e) => {
  console.error(`images: AI generation failed (${e.message}) — keeping the static manifest image`);
  process.exit(0); // best-effort — never block the publish pipeline
});
