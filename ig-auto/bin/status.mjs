#!/usr/bin/env node
// status.mjs — one screen answering "is this healthy?".
// Read-only. Safe to run any time, locally or in CI.
import { config, kindOf, lastPostKey, listQueue, readLedger, state, today } from "../lib/queue.mjs";
import { libraryFiles } from "../lib/image.mjs";

const ledger = readLedger();
const ok = ledger.filter((e) => e.ok);
const st = state();

const days = (n, kind) =>
  ok.filter((e) => kindOf(e) === kind && Date.parse(e.at) > Date.now() - n * 86_400_000).length;

console.log(`Chifbay Instagram — ${today()} (${config.timezone})`);
console.log(`transport ${config.transport}`);
console.log("");

for (const [kind, target, low] of [
  ["feed", config.queue_target, config.queue_low_alert],
  ["story", config.story_queue_target, config.story_queue_low_alert],
]) {
  const q = listQueue(kind);
  const sent = ok.filter((e) => kindOf(e) === kind);
  console.log(`  ${kind.toUpperCase()}`);
  console.log(`    queue      ${q.length}/${target}${q.length <= low ? "  << LOW" : ""}`);
  console.log(`    last       ${st[lastPostKey(kind)] ?? "never"}`);
  console.log(`    posted     ${sent.length} total · ${days(7, kind)} in 7d · ${days(30, kind)} in 30d`);
  if (q.length) {
    const next = q.slice(0, 3).map((i) => `${i.angle}`).join(", ");
    console.log(`    next up    ${next}`);
  }
  console.log("");
}

console.log(`  failures   ${ledger.filter((e) => !e.ok).length}`);
console.log(`  library    ${libraryFiles().length} real photos`);

const recent = ok.slice(-5).reverse();
if (recent.length) {
  console.log("\n  last posts:");
  for (const e of recent) {
    console.log(
      `    ${e.at.slice(0, 10)}  ${kindOf(e).padEnd(6)} ${String(e.angle).padEnd(10)}` +
      ` ${e.confirmed ? "confirmed" : "unconfirmed"}`,
    );
  }
}
