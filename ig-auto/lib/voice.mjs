// voice.mjs — one idea, three different texts: Instagram, Facebook, Threads.
//
// Theo, 11 Oct 2026: "make captions adapted to each social. On Threads it should not be long. On
// Instagram it can be long. Facebook, I don't know. It has to be adapted, and not look like spam,
// be teasing and entertaining."
//
// Instagram text is written when the post is queued (lib/caption.mjs, long, with a hook).
// Facebook and Threads texts are written here, when the post is sent, from the Instagram text,
// the facts and the picture, by Claude Code (same subscription token as the captions). If Claude
// is not available (weekly limit, network), the plain adaptation in crosspost.mjs is used instead:
// a failure here must never cost a post.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { brand, SITE_ROOT } from "./queue.mjs";
import { similarity } from "./caption.mjs";
import { hasPlace } from "./seo.mjs";
import { COMMON, smells } from "./tone.mjs";

/** What each channel is for. The numbers are hard limits checked on the answer. */
export const SPEC = {
  facebook: {
    min: 200, max: 650,
    brief: [
      "A Facebook Page post. Facebook readers are mostly 35+, chatty, here for a smile and a bit of daydreaming.",
      "Write 2 to 5 short lines (200 to 600 characters in all), like a friendly crew member telling a mini story.",
      "Open with a hook line that makes people want to read on. Finish with ONE playful question or a soft",
      "invitation that is easy to answer in the comments (for example who they would bring, or which spot they would pick).",
      "No hashtags. Do not write any web address or the words 'link in bio': a link is added after your text.",
    ],
  },
  threads: {
    min: 40, max: 230,
    brief: [
      "A Threads post. Threads is quick, dry and conversational: it reads like a person typed it in ten seconds.",
      "Write ONE to THREE very short lines, 60 to 220 characters in all: a small confession, a funny observation,",
      "a mild hot take or a question about the sea. A tease, not a description. Not a mini ad.",
      "No hashtags, no web address, no 'link in bio', no 'book now'. No emoji unless the joke needs one.",
    ],
  },
};

/** Hard checks on a written text. Returns the list of problems (empty = fine). */
export function problems(channel, text) {
  const spec = SPEC[channel];
  const bad = [];
  const t = String(text ?? "").trim();
  if (t.length < spec.min) bad.push(`too short (${t.length})`);
  if (t.length > spec.max) bad.push(`too long (${t.length}, limit ${spec.max})`);
  if (/#\w/.test(t)) bad.push("hashtags");
  if (/https?:\/\/|www\.|link in bio|chifbay\.com/i.test(t)) bad.push("a web address or 'link in bio'");
  if (/(?:€|£|\$|\beuros?\b|\busd\b)\s*\d|\d+\s*(?:€|£|\$|euros?\b|usd\b)/i.test(t)) bad.push("a price");
  if (/\b(?:six|seven|eight|nine|ten|[6-9]|1\d)\s+(?:guests|people|passengers)\b/i.test(t)) bad.push("more than 5 guests");
  if (/guarantee|guaranteed|cheapest|best price/i.test(t)) bad.push("a promise or price claim");
  if (/book now|don'?t miss|limited spots|hidden gem|unforgettable|breathtaking|bucket list/i.test(t)) bad.push("ad words");
  if (/[–—]/.test(t)) bad.push("a long dash");
  if (/!{2,}/.test(t) || (t.match(/!/g) ?? []).length > 1) bad.push("too many exclamation marks");
  if ((t.match(/\p{Extended_Pictographic}/gu) ?? []).length > 2) bad.push("too many emoji");
  if (!hasPlace(t, 200)) bad.push("no Funchal or Madeira");
  return bad;
}

function parse(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("no JSON in the reply");
  return JSON.parse(body.slice(a, b + 1));
}

/** The picture a post shows, as a file in the repository, or null. */
export function pictureOf(item) {
  const rels = [item.cover_url && item.cover_url.replace(/^https?:\/\/(?:www\.)?chifbay\.com\//, ""),
    item.slides?.[0]?.image, item.image, item.origin].filter(Boolean);
  for (const rel of rels) { const abs = join(SITE_ROOT, rel); if (existsSync(abs) && /\.(jpe?g|png)$/i.test(abs)) return abs; }
  return null;
}

const asClaude = (prompt) => execFileSync(process.env.CLAUDE_BIN || "claude", ["-p", prompt, "--allowedTools", "Read"],
  { encoding: "utf8", timeout: 180_000, maxBuffer: 4 * 1024 * 1024 }).trim();

/**
 * The text for one channel, or null when it could not be written (the caller then adapts the
 * Instagram text). `ask` is injectable for tests. `recent` = the last texts sent on this channel,
 * so two posts never sound alike.
 */
export function writeFor(channel, item, { recent = [], ask = asClaude, log = console.log } = {}) {
  const spec = SPEC[channel];
  const picture = pictureOf(item);
  const source = String(item.caption ?? "").trim();
  const prompt = [
    `Write the ${channel === "facebook" ? "Facebook Page" : "Threads"} version of one social post for a small private boat tour business in Madeira.`,
    picture ? `Look at the picture first: ${picture}` : "There is no picture to look at; use the Instagram text.",
    item.media === "video" ? "It is a short video (a Reel); the picture is its cover." : "",
    "",
    "What this post is about, as already written for Instagram (do not copy it, tell it differently):",
    source ? `---\n${source}\n---` : "(no text)",
    "",
    "Channel:", ...spec.brief,
    "", COMMON, "",
    `Business facts (do not contradict): ${JSON.stringify(brand.facts)}`,
    recent.length ? `Do NOT reuse the opening, joke or structure of these recent posts:\n${recent.slice(0, 6).map((t) => `---\n${t}`).join("\n")}` : "",
    "",
    'Reply with ONLY a JSON object: {"text": "the post text"}',
  ].filter((x) => x !== "").join("\n");

  let why = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const text = String(parse(ask(prompt + (why ? `\n\nYour last try was rejected: ${why}. Fix exactly that.` : ""))).text ?? "").trim();
      const bad = problems(channel, text);
      const alike = recent.find((r) => similarity(text, r) > 0.45);
      if (!bad.length && !alike) return text;
      why = bad.join(", ") || "too similar to a recent post";
      log(`${channel} text attempt ${attempt} rejected: ${why}`);
    } catch (err) {
      log(`${channel} text attempt ${attempt} failed: ${String(err.message).split("\n")[0].slice(0, 160)}`);
      why = "";
      if (/limit|quota|usage|ENOENT/i.test(String(err.message))) break; // Claude is out: do not hammer it
    }
  }
  return null;
}
