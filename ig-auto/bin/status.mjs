#!/usr/bin/env node
// status.mjs — one screen answering "is this healthy?".
// Read-only. Safe to run any time, locally or in CI.
import { config, listQueue, readLedger, state, today } from "../lib/queue.mjs";
import { libraryFiles } from "../lib/image.mjs";

const ledger = readLedger();
const ok = ledger.filter((e) => e.ok);
const queue = listQueue();
const st = state();

const days = (n) => ok.filter((e) => Date.parse(e.at) > Date.now() - n * 86_400_000).length;

console.log(`Chifbay Instagram — ${today()} (${config.timezone})`);
console.log("");
console.log(`  queue        ${queue.length}/${config.queue_target}${queue.length <= config.queue_low_alert ? "  << LOW" : ""}`);
console.log(`  last post    ${st.last_post_date ?? "never"}`);
console.log(`  posted       ${ok.length} total · ${days(7)} in 7d · ${days(30)} in 30d`);
console.log(`  failures     ${ledger.filter((e) => !e.ok).length}`);
console.log(`  library      ${libraryFiles().length} real photos`);
console.log("");

if (queue.length) {
  console.log("  next up:");
  for (const i of queue.slice(0, 5)) {
    console.log(`    ${i.id}  ${String(i.angle).padEnd(10)} ${i.source.padEnd(8)} ${i.hashtags.length} tags  ${i.writer}`);
  }
  console.log("");
}

const recent = ok.slice(-5).reverse();
if (recent.length) {
  console.log("  last posts:");
  for (const e of recent) {
    console.log(`    ${e.at.slice(0, 10)}  ${String(e.angle).padEnd(10)} ${e.confirmed ? "confirmed" : "unconfirmed"}`);
  }
}
