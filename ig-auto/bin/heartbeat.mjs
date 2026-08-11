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
// Runs twice a week. Silence means the feed is genuinely alive.
import { config, listQueue, readLedger, state, today } from "../lib/queue.mjs";
import { alert } from "../lib/notify.mjs";

const DAY = 86_400_000;
const maxDays = config.heartbeat_max_days_since_post ?? 2;

const queue = listQueue();
const ledger = readLedger();
const ok = ledger.filter((e) => e.ok);
const last = state().last_post_date ?? null;
const lastOk = ok.at(-1) ?? null;

const daysSince = last
  ? Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / DAY)
  : null;

console.log(`last post   ${last ?? "never"}${daysSince === null ? "" : ` (${daysSince} day(s) ago)`}`);
console.log(`queue       ${queue.length}/${config.queue_target}`);
console.log(`posted      ${ok.length} total`);
console.log(`transport   ${config.transport}`);

const problems = [];

if (!last) {
  // Not an alert on a fresh install — there is genuinely nothing to report yet.
  console.log("\nnothing posted yet — run the daily post workflow once to start");
} else if (daysSince > maxDays) {
  problems.push(`nothing has been posted for ${daysSince} days`);
}

if (queue.length === 0) {
  problems.push("the queue is empty — the next post has nothing to send");
} else if (queue.length <= config.queue_low_alert) {
  problems.push(`only ${queue.length} post(s) left in the queue`);
}

// A post that went out but was never confirmed means the transport answered
// without proof. Worth knowing before it becomes a run of missing posts.
if (lastOk && lastOk.confirmed === false) {
  problems.push("the last post was not confirmed by the transport — check the account by hand");
}

const recentFails = ledger.filter((e) => !e.ok && Date.parse(e.at) > Date.now() - 7 * DAY);
if (recentFails.length >= 3) {
  problems.push(`${recentFails.length} failures in the last 7 days`);
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
