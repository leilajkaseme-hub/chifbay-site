// tone.mjs — the voice shared by the three channels (no imports, so every other module may use it).
// Theo, 11 Oct 2026: teasing and entertaining, adapted to each social, never like spam.

export const COMMON = [
  "Voice: a small local crew that is funny and warm and never salesy. Tease: a small curiosity gap, a playful",
  "observation about what is VISIBLE, a detail only someone on the boat would notice. Concrete beats adjectives.",
  "One idea per post. It must not look like spam or an ad: no 'book now', no 'don't miss', no list of benefits,",
  "no all-caps, no stacked exclamation marks, no emoji wall (none or one). Never start with 'Imagine'. Do not use",
  "'hidden gem', 'unforgettable', 'breathtaking', 'stunning', 'bucket list'.",
  "Truth: wit is welcome, invention is not. Only what is in the picture and in the facts below. No invented",
  "quotes, house rules, reactions ('everyone goes quiet'), conversations, names, numbers or times. Do not claim",
  "what the guests felt or said. No prices. No more than five guests. Never promise wildlife. Do not say 'today'",
  "or 'this morning'.",
  "Search: the place (Funchal or Madeira) appears once, naturally, near the start, not as a label.",
  "Variety: never end with the same kind of line as the recent posts below (not every post asks who you would bring).",
].join("\n");

/** Instagram: long is welcome. */
export const IG_BRIEF = [
  "An Instagram caption. Long is welcome: 400 to 900 characters.",
  "Line 1 (at most 110 characters) is the teaser: it makes people tap 'more', and it also names Funchal or Madeira",
  "and what we sell in plain words, because people and search both see it first (for example 'Cabo Girão boat tour",
  "from Funchal: the cliff has a trick.'). Then 4 to 8 short lines: tell what the picture shows like a little story,",
  "with one funny or surprising observation, then one true practical fact (Day Trip, Sunset Trip, swim stop, Cabo Girão,",
  "what is included), then one closing line: a question, or a soft invitation. Short lines, blank lines between ideas.",
  "No hashtags (they are added separately).",
].join("\n");

/** Words and habits that make a post look like an ad. Returns the problems found. */
export function smells(t) {
  const bad = [];
  if (/book now|don'?t miss|limited spots|hidden gem|unforgettable|breathtaking|stunning|bucket list/i.test(t)) bad.push("ad words");
  if (/[–—]/.test(t)) bad.push("a long dash");
  if ((t.match(/!/g) ?? []).length > 1) bad.push("too many exclamation marks");
  if ((t.match(/\p{Extended_Pictographic}/gu) ?? []).length > 2) bad.push("too many emoji");
  if (/\b[A-Z]{5,}\b/.test(t.replace(/\b(?:UNESCO|INSTA|GYG)\b/g, ""))) bad.push("shouting");
  return bad;
}
