// caption.mjs — writes the words, and refuses to repeat itself.
//
// Text comes from Claude Code using the subscription OAuth token that
// blog-auto.yml already uses (secret CLAUDE_CODE_OAUTH_TOKEN), so there is no
// API key and no per-post cost. If the CLI is missing or the model returns
// something that breaks the brand rules, a plain template takes over — the
// queue must never starve because a caption was hard to write.
//
// Repetition is the thing that actually gets a small account throttled, so
// three separate guards run here:
//   - the angle is chosen least-recently-used, not at random
//   - hashtag sets are rebuilt every time and never match a recent set exactly
//   - a similarity check against the last 30 captions forces a rewrite
import { execFileSync } from "node:child_process";
import { brand, config, recentPosts } from "./queue.mjs";

// --- variety helpers -------------------------------------------------------

/** Least recently used wins, so all 12 angles cycle before any repeats. */
export function pickAngle(recent) {
  const usedAt = new Map();
  recent.forEach((p, i) => { if (!usedAt.has(p.angle)) usedAt.set(p.angle, i); });
  return [...brand.angles].sort(
    (a, b) => (usedAt.get(b.key) ?? 1e9) - (usedAt.get(a.key) ?? 1e9),
  )[0];
}

const rotate = (pool, recentTags, want) => {
  const score = (t) => recentTags.indexOf(t); // -1 = never used recently, so it sorts first
  return [...pool].sort((a, b) => {
    const [sa, sb] = [score(a), score(b)];
    return (sa === -1 ? -1e9 : -sa) - (sb === -1 ? -1e9 : -sb);
  }).slice(0, want);
};

/**
 * 5-8 tags: place, activity, then tags specific to what is actually in the
 * photo, then a travel tag. Biased to whichever have been used longest ago, and
 * never the exact set of a recent post. Instagram's own guidance is a handful of
 * relevant tags; the same block of 30 every day is the classic reach killer.
 */
export function pickHashtags(recent, angle) {
  const recentTags = recent.flatMap((p) => p.hashtags ?? []);
  const recentSets = new Set(recent.slice(0, 10).map((p) => (p.hashtags ?? []).join(" ")));
  const banned = new Set(brand.hashtag_banned);
  const { min, max } = config.hashtags;
  // Vary the length post to post instead of always sitting on the minimum.
  const target = min + (recent.length % (max - min + 1));

  // The angle's own tags come first and the generic pool only tops up. Mixing
  // both into one rotation put #dolphinwatching on a sunset photo, because
  // least-recently-used does not know what is in the picture.
  const theme = (n) => [
    ...rotate(angle?.tags ?? [], recentTags, n),
    ...rotate(brand.hashtag_pools.theme, recentTags, n),
  ].filter((t, i, a) => a.indexOf(t) === i).slice(0, n);

  for (let spread = 0; spread < 6; spread++) {
    const p = brand.hashtag_pools;
    const tags = [
      ...rotate(p.place, recentTags, 2),
      ...rotate(p.activity, recentTags, 2),
      ...theme(2),
      ...rotate(p.travel, recentTags, 2),
    ]
      .filter((t, i, a) => !banned.has(t) && a.indexOf(t) === i)
      .slice(0, Math.min(max, target + spread));

    if (tags.length >= min && !recentSets.has(tags.join(" "))) return tags;
    recentTags.push(...tags); // shift the ranking and try a different mix
  }
  return [...new Set([...themePool.slice(0, 3), ...brand.hashtag_pools.place.slice(0, 2)])];
}

const bigrams = (s) => {
  const w = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  return new Set(w.slice(0, -1).map((x, i) => `${x} ${w[i + 1]}`));
};

export function similarity(a, b) {
  const [A, B] = [bigrams(a), bigrams(b)];
  if (!A.size || !B.size) return 0;
  const shared = [...A].filter((x) => B.has(x)).length;
  return shared / new Set([...A, ...B]).size;
}

// --- brand rules -----------------------------------------------------------

/** Hard checks. A caption that trips any of these is never posted. */
export function violations(text) {
  const bad = [];
  const t = text.toLowerCase();
  if (/(?:€|£|\$|\beur\b|\busd\b)\s*\d|\d+\s*(?:€|£|\$|eur\b|usd\b)/i.test(text)) bad.push("mentions a price");
  if (/\b(?:six|seven|eight|nine|ten|[6-9]|1\d)\s+(?:guests|people|passengers)\b/i.test(text)) bad.push("more than 5 guests");
  if (/guarantee|guaranteed/i.test(t)) bad.push("guarantees something");
  if (/cheapest|best price|lowest price/i.test(t)) bad.push("price claim");
  if (/#/.test(text)) bad.push("hashtags inside the caption body");
  if (text.length > 1500) bad.push("too long");
  if (text.trim().length < 40) bad.push("too short");
  return bad;
}

// --- generation ------------------------------------------------------------

// `--allowedTools Read` is what lets the caption describe the actual picture.
// Without it the model writes about the angle we guessed, which is how you end
// up captioning a photo of guests at the rail with "the dolphins came to us".
function askClaude(prompt) {
  return execFileSync("claude", ["-p", prompt, "--allowedTools", "Read"], {
    encoding: "utf-8",
    timeout: 300_000,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

/** Models like to wrap JSON in prose or code fences. Dig it out. */
function parseReply(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(body.slice(start, end + 1));
}

function template(angle, cta) {
  return `${angle.brief}\n\nPrivate boat from Funchal, skipper included, five guests maximum.\n\n${cta}`;
}

/**
 * Look at the image, then write about what is actually in it.
 *
 * `angleHint` only decided which picture to fetch; the model is free to tell us
 * the photo is really about something else, and the returned angle is what the
 * hashtags and the variety rotation are then based on.
 *
 * Returns { text, hashtags, angle, writer }. Never throws — the template path
 * always produces something publishable, because a missing caption must never
 * be the reason a day gets skipped.
 */
export function writeCaption({ imagePath, angleHint, recent, source = "library" }) {
  const cta = brand.ctas[recent.length % brand.ctas.length];
  const recentTexts = recent.map((p) => p.caption ?? "").filter(Boolean);
  const keys = brand.angles.map((a) => a.key);

  // A generated picture must never be written about as a thing that happened.
  // Left unguarded the model produced "one came clear out of the water, right
  // off our side" for an AI dolphin — a fabricated moment sold as a real trip,
  // to customers who book hoping to see exactly that.
  const sourceRules = source === "ai"
    ? [
        "IMPORTANT: this picture is ILLUSTRATIVE, not a photo of a real trip.",
        "Do NOT describe it as something that happened. No 'today', no 'this",
        "morning', no 'right off our side', no guests, no first-person story.",
        "Write about the place or the feeling in general terms instead.",
      ]
    : [
        "This is a real photo from one of our trips.",
      ];

  const prompt = [
    `Read the image at ${imagePath}, then write ONE Instagram caption for it.`,
    "It is for a small private boat tour business in Madeira.",
    "",
    ...sourceRules,
    "",
    "Describe what is genuinely in THIS picture. Never invent something that is",
    "not visible — no dolphins if there are no dolphins, no sunset in daylight.",
    "Never invent HOW or WHEN it was taken. Do not say it was shot from a drone,",
    "or that it was yesterday or this morning, unless the picture truly shows it.",
    "",
    "Voice rules:",
    ...brand.voice.map((v) => `- ${v}`),
    "",
    `Business facts (do not contradict): ${JSON.stringify(brand.facts)}`,
    `Suggested angle if the photo fits it: ${angleHint.key} — ${angleHint.brief}`,
    `End with this call to action, in your own phrasing: "${cta}"`,
    "",
    "Hard rules: no hashtags at all (they are added separately). No prices.",
    "Never say more than five guests. Never guarantee wildlife sightings.",
    "2 to 5 short lines. Plain English.",
    "",
    recentTexts.length
      ? `Do NOT reuse the phrasing, opening line or structure of these recent captions:\n${recentTexts.slice(0, 8).map((t) => `---\n${t}`).join("\n")}`
      : "",
    "",
    `Reply with ONLY a JSON object: {"angle": one of ${JSON.stringify(keys)}, "caption": "the caption text"}`,
    "Pick the angle that truly matches the photo, not the suggested one if it does not fit.",
  ].join("\n");

  for (let attempt = 1; attempt <= 3; attempt++) {
    let reply;
    try {
      reply = parseReply(askClaude(prompt));
    } catch (err) {
      console.warn(`claude caption attempt ${attempt} failed: ${err.message}`);
      continue;
    }
    const text = String(reply.caption ?? "").trim();
    const angle = brand.angles.find((a) => a.key === reply.angle) ?? angleHint;
    const bad = violations(text);
    const tooSimilar = recentTexts.find(
      (t) => similarity(text, t) > config.caption_similarity_max,
    );
    if (!bad.length && !tooSimilar) {
      return { text, hashtags: pickHashtags(recent, angle), angle: angle.key, writer: "claude" };
    }
    console.warn(
      `caption attempt ${attempt} rejected: ${bad.join(", ") || "too similar to a recent caption"}`,
    );
  }

  return {
    text: template(angleHint, cta),
    hashtags: pickHashtags(recent, angleHint),
    angle: angleHint.key,
    writer: "template",
  };
}

/** The caption exactly as Instagram will see it. */
export function render({ text, hashtags }) {
  return `${text.trim()}\n\n${hashtags.join(" ")}`;
}
