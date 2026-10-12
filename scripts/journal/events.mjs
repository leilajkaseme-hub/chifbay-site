// events.mjs: which Madeira event, if any, a Journal post should be timed for.
//
// Theo, 12 Oct 2026: "a subject that is or is not related to current events in Madeira. If it is the
// Flower Festival, talk about it a few days before. If nothing is happening, post what is good for the
// SEO and the GEO." People plan a trip 1 to 3 weeks ahead, so the guide goes live that long BEFORE the
// event, not on the day. A day with no event gets the normal evergreen topic.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "events.json");
const DAY = 86_400_000;
const days = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / DAY);

/** Events whose "guide" window holds `day`, nearest first. `events` is injectable for tests. */
export function eventsFor(day, events = JSON.parse(readFileSync(FILE, "utf8")).events) {
  return events
    .map((e) => ({ ...e, in: days(e.start) - days(day) }))
    .filter((e) => e.in >= e.guide[0] && e.in <= e.guide[1])
    .sort((a, b) => a.in - b.in);
}

/** A block for the writer's prompt, or "" when the day has no event. `covered` = titles already published or queued. */
export function eventBrief(day, covered = [], events) {
  const e = eventsFor(day, events).find((x) => !covered.some((t) => new RegExp(x.name.split(/[ (]/).slice(0, 3).join(".{0,12}"), "i").test(t)));
  if (!e) return "";
  const when = e.start === e.end ? e.start : `${e.start} to ${e.end}`;
  return `- **Timed post.** ${e.name} (${when}) starts in ${e.in} days. This post is the planning guide for it: what it is,
  the dates, what to see, how to use the day, and where a small private boat from Funchal fits (the bay is
  often the best seat). Keep it useful and honest. ${e.note}
  Dates come from the official Visit Madeira calendar, which can change: confirm them with WebSearch before you
  write, and if you cannot confirm a date, write about the season without that date.
  The three photos show the real scene: ${e.scene}.\n`;
}
