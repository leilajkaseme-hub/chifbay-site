// approval.mjs: nothing goes to Instagram unless Theo approved it.
//
// Theo approves posts on the Instagram page of the Chifbay portal. The portal
// keeps one row per approved item: its id, its kind and the day it may go out.
// The poster asks the portal for that list and only takes items that are
// approved AND due (their day is today or earlier, in Madeira time).
//
// It fails closed. If the list cannot be read, nothing is approved, so nothing
// posts. A missed day is cheap; a post he never saw is the thing he asked us
// to make impossible.
import { config, today } from "./queue.mjs";

export const APPROVALS_URL =
  process.env.IG_APPROVALS_URL || config.approvals_url ||
  "https://chifbay-booking-api.chifandcopt.workers.dev/v1/ig/approvals";

/** Map id -> {id, kind, day}. Throws when the list cannot be read. */
export async function readApprovals() {
  const res = await fetch(APPROVALS_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`approvals answered HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.items)) throw new Error("approvals answer has no items list");
  return new Map(body.items.map((x) => [x.id, x]));
}

/** Items of the queue that are approved and due, earliest day first. */
export function dueApproved(queue, approvals, day = today()) {
  return queue
    .filter((i) => {
      const a = approvals.get(i.id);
      return a && typeof a.day === "string" && a.day <= day;
    })
    .sort((x, y) => approvals.get(x.id).day.localeCompare(approvals.get(y.id).day) ||
      (x.created ?? "").localeCompare(y.created ?? ""));
}
