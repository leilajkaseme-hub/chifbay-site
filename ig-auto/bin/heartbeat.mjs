#!/usr/bin/env node
// heartbeat.mjs — notices when the whole thing has quietly stopped.
//
// Every other check in this project verifies one step. This one ignores the
// steps entirely and asks the only question that matters: did a post actually
// go out recently? If the answer is no, something upstream is broken and it
// does not matter what.
//
// It is the backstop for failures that produce no error anywhere: the schedule
// silently disabled, the Make organisation out of operations, the repo's
// Actions turned off, a queue that ran dry while nobody was looking.
//
// Runs every day at 21:00 UTC, after both posting windows and both catch-up
// runs have closed, so "nothing went out today" is a real answer and not a
// race with a job still waiting out its jitter. Silence means the feed is
// genuinely alive, today.
import { config, kindOf, lastPostKey, listQueue, readLedger, state, today } from "../lib/queue.mjs";
import { alert } from "../lib/notify.mjs";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Hours, not calendar days.
 *
 *  This used to ask "did a post go out TODAY", which is the right question and
 *  the wrong unit. GitHub's shared cron is best effort and drifts badly on this
 *  repo: the 2026-08-28 feed post was scheduled for 10:00 UTC and actually went
 *  out at 23:46 UTC, and the 21:00 heartbeat of 2026-08-26 did not run until
 *  00:22 the next day. Either drift alone flips a calendar-day comparison, and
 *  on 2026-08-27 one did — it alerted "no feed post for 1 days" on a day that
 *  had posted normally.
 *
 *  A false alarm is worse than no alarm: it is what teaches everyone to swipe
 *  the notification away, and this feed already died once behind an alert
 *  nobody trusted. Elapsed hours cannot be flipped by a late run, so the same
 *  strict question survives a schedule that wanders.
 *
 *  40 hours, not 24: the widest REAL gap between two good feed posts in this
 *  ledger is 33.3 hours, so anything under ~36 would fire on a healthy feed.
 *  A feed that genuinely stops is still caught by the following evening's
 *  heartbeat. Detecting a dead feed one run later is a cheap price for an
 *  alert that is always true when it fires. */
const maxHours = config.heartbeat_max_hours_since_post ?? 40;
const maxDays = config.heartbeat_max_days_since_post ?? 2;

/** When this kind last posted successfully, from the ledger, in ms.
 *  The ledger is the only record with a real timestamp — state holds a date
 *  string, which is exactly the resolution that caused the false alarm. */
function lastOkAt(kind) {
  const e = ok.filter((x) => kindOf(x) === kind).at(-1);
  const t = e?.at ? Date.parse(e.at) : NaN;
  return Number.isNaN(t) ? null : t;
}

const ledger = readLedger();
const ok = ledger.filter((e) => e.ok);
const st = state();
const problems = [];

console.log(`transport   ${config.transport}`);

for (const [kind, target, low] of [
  ["feed", config.queue_target, config.queue_low_alert],
  ["story", config.story_queue_target, config.story_queue_low_alert],
]) {
  const queue = listQueue(kind);
  const last = st[lastPostKey(kind)] ?? null;
  const daysSince = last
    ? Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / DAY)
    : null;

  console.log(
    `${kind.padEnd(6)}      last ${last ?? "never"}` +
    `${daysSince === null ? "" : ` (${daysSince}d ago)`}, queue ${queue.length}/${target}`,
  );

  const at = lastOkAt(kind);
  if (!last) {
    // Not an alert on a fresh install — there is genuinely nothing to report.
    console.log(`            nothing posted yet — run the ${kind} workflow once to start`);
  } else if (at !== null) {
    const hours = Math.floor((Date.now() - at) / HOUR);
    if (hours > maxHours) {
      problems.push(`no ${kind} post for ${hours} hours (limit ${maxHours})`);
    }
  } else if (daysSince > maxDays) {
    // No ledger entry to time — fall back to the coarse calendar check.
    problems.push(`no ${kind} post for ${daysSince} days`);
  }

  if (queue.length === 0) {
    problems.push(`the ${kind} queue is empty — the next run has nothing to send`);
  } else if (queue.length <= low) {
    problems.push(`only ${queue.length} ${kind} post(s) left in the queue`);
  }

  // A post that went out but was never confirmed means the transport answered
  // without proof. Worth knowing before it becomes a run of missing posts.
  const lastOk = ok.filter((e) => kindOf(e) === kind).at(-1);
  if (lastOk && lastOk.confirmed === false) {
    problems.push(`the last ${kind} post was not confirmed — check the account by hand`);
  }
}

// Two is the threshold, not three. A single bad window is normal and the
// catch-up run usually rescues it, so the day still looks healthy above. Twice
// in a week is a pattern, and a pattern is the thing that quietly becomes a
// dead account.
const recentFails = ledger.filter((e) => !e.ok && Date.parse(e.at) > Date.now() - 7 * DAY);
if (recentFails.length >= 2) {
  problems.push(
    `${recentFails.length} failures in the last 7 days — read ig-auto/ledger.jsonl, ` +
    "the error field carries Meta's code and subcode",
  );
}

if (problems.length) {
  console.error("\nPROBLEMS:");
  for (const p of problems) console.error(`  - ${p}`);
  await alert(
    "CHIFBAY Instagram may have stopped",
    problems.join("\n") + "\n\nRun bin/status.mjs, or check the Actions tab and the Make scenario.",
  );
  process.exit(1);
}

console.log("\nall good");
