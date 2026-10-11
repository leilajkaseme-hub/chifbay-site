// seo.mjs — the search words of every post, on Instagram, Facebook and Threads.
//
// Theo, 11 Oct 2026: "use keywords on posts to get pushed even more on the SEO and GEO for our
// specific keywords". Instagram search and Google read the CAPTION and the ALT TEXT (hashtags count
// less than they did), Facebook posts are indexed by Google, and AI answers quote plain sentences.
// So every caption opens with a short, plain sentence that holds the place and the service, in the
// words people really search (scripts/data/seo-targets.json): "private boat trip", "Funchal",
// "Madeira", "sunset cruise", "Cabo Girão boat tour". One such phrase per post, never a pile of them.
//
// Facts stay true: the leads below say only what every trip does (brand.facts in brand.json).
import { brand } from "./queue.mjs";

const PLACE = /madeira|funchal/i;

/** How many characters Instagram shows before "more". The place must be inside it. */
export const SHOWN = 125;

export const hasPlace = (text, n = 150) => PLACE.test(String(text).slice(0, n));

/** Lead sentences by angle; "default" covers the rest. All from brand.json so they are easy to edit. */
function leads(angle) {
  const l = brand.seo?.leads ?? {};
  return l[angle] ?? l.default ?? ["Private boat trip from Funchal, Madeira."];
}

/** Stable pick: the same post always gets the same lead, different posts get different ones. */
function pick(list, seed) {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/** The angle a post is about, also for Reels (their id names the subject). */
export function angleOf(item) {
  const a = item.angle;
  if (a && a !== "reel") return a;
  const id = `${item.id ?? ""} ${item.subject ?? ""}`;
  if (/sunset/i.test(id)) return "sunset";
  if (/cabo|girao|cliff/i.test(id)) return "cliffs";
  if (/jump|paddle|swim|split/i.test(id)) return "swimstop";
  return "default";
}

/** The caption with a keyword lead in front, unless it already names the place early. */
export function withLead(caption, item) {
  const text = String(caption ?? "").trim();
  if (hasPlace(text)) return text;
  const lead = pick(leads(angleOf(item)), item.id ?? text);
  return `${lead}\n\n${text}`;
}

/** Alt text for a photo: what is shown, then where and what we sell. Plain words, under 200 characters. */
export function altFor(item, n = 0) {
  const custom = item.slides?.[n]?.alt;
  if (custom) return custom;
  const a = angleOf(item);
  const what = (brand.seo?.alt ?? {})[a] ?? (brand.seo?.alt ?? {}).default ?? "Private boat trip from Funchal, Madeira";
  return what;
}

/** Hashtags for the other channels: Facebook and Threads want few, and the place and service first. */
export function fewTags(hashtags, n) {
  const first = ["#madeira", "#funchal", "#madeiraboattrip", "#privateboattour", "#cabogirao", "#sunsetcruisemadeira"];
  const have = (hashtags ?? []).map((t) => t.toLowerCase());
  const ordered = [...first.filter((t) => have.includes(t)), ...have.filter((t) => !first.includes(t))];
  return [...new Set(ordered)].slice(0, n);
}
