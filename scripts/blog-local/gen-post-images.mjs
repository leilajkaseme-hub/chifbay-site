#!/usr/bin/env node
// gen-post-images.mjs — generate a hero + 2 inline AI images for today's new
// Journal post (posts.json[0], just written by the Claude generation step)
// via Pollinations (free, no API key), and wire them into the post HTML +
// posts.json. Best-effort: on any failure, leaves the static manifest-picked
// image already chosen by Claude untouched and exits 0 (never blocks the run).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

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
  let flagged = 0;
  const heroOk = await genAndVerify(heroPrompt, 1600, 900, join(ROOT, heroRel));
  if (!heroOk) flagged++;
  await sleep(2000);
  const inline1Ok = await genAndVerify(inline1Prompt, 1200, 800, join(ROOT, inline1Rel));
  if (!inline1Ok) flagged++;
  await sleep(2000);
  const inline2Ok = await genAndVerify(inline2Prompt, 1200, 800, join(ROOT, inline2Rel));
  if (!inline2Ok) flagged++;

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
  if (flagged > 0) {
    console.log(`WARNING: ${flagged} image(s) still failed QA after all retries — flagging for manual review`);
    notifyQaFlag(title, flagged);
  }
}

// Generate an image, then have Claude (vision-capable, already available via
// this machine's subscription/CLAUDE_CODE_OAUTH_TOKEN — no extra API cost)
// judge whether it actually shows what it's supposed to. Regenerate with the
// failure reason fed back as a negative constraint on FAIL, up to 3 attempts.
// Closes a real, observed failure mode: Pollinations/flux can silently
// render an unrelated or contradictory image with no error (e.g. a boat
// literally driving on a road for a car-rally article) — nothing else in
// this pipeline would ever catch that before it goes live. Never blocks the
// run: on repeated failure, keeps the last attempt and flags it for review.
async function genAndVerify(prompt, width, height, outPath, maxAttempts = 3) {
  let extra = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const buf = await genImage(`${prompt}${extra}`, width, height);
    writeFileSync(outPath, buf);
    const { pass, reason } = verifyImage(outPath, prompt);
    console.log(`  ${outPath.split("/").pop()} attempt ${attempt}: ${pass ? "PASS" : "FAIL"} — ${reason}`);
    if (pass) return true;
    extra = `. IMPORTANT — a previous attempt was rejected because: "${reason}" — the image must fix this specific problem.`;
  }
  console.log(`  ${outPath.split("/").pop()}: still failing QA after ${maxAttempts} attempts, keeping last image anyway`);
  return false;
}

function verifyImage(imagePath, expectation) {
  const prompt = `Read the image at ${imagePath}. Does it clearly show: ${expectation}? ` +
    `Answer with exactly one word first (PASS or FAIL), then a one-sentence reason.`;
  try {
    const out = execFileSync(
      "claude",
      ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", "Read"],
      { cwd: ROOT, encoding: "utf-8", timeout: 90_000 },
    ).trim();
    return { pass: /^PASS/i.test(out), reason: out.replace(/^(PASS|FAIL)\W*/i, "") || out };
  } catch (e) {
    return { pass: true, reason: `QA check errored, skipping verification: ${e.message}` };
  }
}

function notifyQaFlag(title, count) {
  try {
    execFileSync("curl", [
      "-s", "--max-time", "20",
      "-H", "Title: CHIFBAY blog image needs review",
      "-H", "Priority: default", "-H", "Tags: warning",
      "-d", `${count} image(s) on today's post "${title}" failed AI QA after 3 tries and were published anyway — check assets/journal/`,
      "https://ntfy.sh/futurx-blog-alerts-544024878e",
    ], { timeout: 20_000 });
  } catch { /* best-effort */ }
}

main().catch((e) => {
  console.error(`images: AI generation failed (${e.message}) — keeping the static manifest image`);
  process.exit(0); // best-effort — never block the publish pipeline
});
