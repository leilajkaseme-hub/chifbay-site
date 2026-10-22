#!/usr/bin/env node
// reviews.mjs: answer the Google reviews of the main profile.
//
//   node gbp/reviews.mjs           answer the unanswered ones (4 and 5 stars), at most 10 a run
//   node gbp/reviews.mjs --dry     write the drafts, post nothing
//
// The words come from the booking Worker (POST /v1/replies/review-draft, Workers AI): the same writer as the
// GetYourGuide and Tripadvisor replies (stores/chifbay/review-replies): short, human, in the reviewer's language,
// never the same opening twice, never a name the review does not mention. 1 to 3 stars are never answered by the
// robot: Theo gets the review and a draft on his phone.
import { pathToFileURL } from "node:url";
import { api, ledger, ntfy, record, syncSecret, v4, where } from "./lib.mjs";

const DRY = process.argv.includes("--dry");
const MAX = 10;
const WORKER = "https://chifbay-booking-api.chifandcopt.workers.dev";
const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };


// Google gives "original (Translated by Google) translation" or "(Translated by Google) translation (Original) original".
export function original(comment = "") {
  const c = comment.trim();
  if (/\(Original\)/i.test(c)) return c.split(/\(Original\)/i).pop().trim();
  return c.split(/\(Translated by Google\)/i)[0].trim();
}

// Madeira is Portugal: a Portuguese review gets Portugal Portuguese ("tê-la a bordo"), never the Brazilian "você".
const PT = /\b(muito|obrigad[oa]|experiência|recomendo|passeio|barco|foi|equipa)\b/i;
const BRAZIL = /\bvocês?\b|\bter você\b|\bequipe\b/i;

async function draft(review, avoid) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${WORKER}/v1/replies/review-draft`, {
      method: "POST",
      headers: { Authorization: `Bearer ${syncSecret()}`, "Content-Type": "application/json", "User-Agent": "chifbay-gbp/1.0" },
      body: JSON.stringify({ platform: "Google", ...review, avoid }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.reply) throw new Error(`no draft: ${j.error ?? r.status}`);
    if (!(review.language === "pt-PT" && BRAZIL.test(j.reply))) return j.reply;
  }
  throw new Error("only Brazilian Portuguese drafts");
}

async function main() {
  const at = await where();
  const all = [];
  let page = "";
  do {
    const j = await api("GET", v4(`${at.path}/reviews?pageSize=50${page ? `&pageToken=${page}` : ""}`));
    all.push(...(j.reviews ?? []));
    page = j.nextPageToken ?? "";
  } while (page && all.length < 500);
  const open = all.filter((r) => !r.reviewReply);
  console.log(`${all.length} reviews, ${open.length} without a reply (${at.title})`);
  const avoid = ledger().filter((e) => e.kind === "review" && e.reply).slice(-10).map((e) => e.reply);
  // Theo's own replies on this profile (not the robot's): the voice to follow.
  const mine = new Set(ledger().filter((e) => /^review/.test(e.kind)).map((e) => e.id));
  const examples = all.filter((r) => r.reviewReply?.comment && !mine.has(r.reviewId))
    .sort((a, b) => b.reviewReply.updateTime.localeCompare(a.reviewReply.updateTime)).slice(0, 2).map((r) => r.reviewReply.comment);
  let done = 0;
  for (const r of open.sort((a, b) => a.createTime.localeCompare(b.createTime))) {
    if (done >= MAX) break;
    const rating = STARS[r.starRating] ?? 0;
    const text = original(r.comment);
    const review = { rating, author: r.reviewer?.displayName ?? "", text: text || `(${rating} stars, no text)`,
                     language: PT.test(text) ? "pt-PT" : "", examples };
    let reply;
    try { reply = await draft(review, avoid); } catch (e) { console.log(`  ${r.reviewId}: ${e.message}`); continue; }
    if (rating <= 3) {
      if (!ledger().some((e) => e.kind === "review-held" && e.id === r.reviewId)) {
        await ntfy(`Chifbay Google review ${rating} stars: your call`, `${review.author}: ${text.slice(0, 600)}\n\nDraft:\n${reply}\n\nAnswer it in Google Maps, or tell Claude to post the draft.`);
        if (!DRY) record({ kind: "review-held", id: r.reviewId, rating, author: review.author, reply });
      }
      console.log(`  held ${rating}* ${review.author}: ${reply}`);
      continue;
    }
    console.log(`  ${rating}* ${review.author}: ${reply}`);
    if (DRY) { done++; avoid.push(reply); continue; }
    await api("PUT", v4(`${at.path}/reviews/${r.reviewId}/reply`), { comment: reply });
    record({ kind: "review", id: r.reviewId, rating, author: review.author, reply });
    avoid.push(reply);
    done++;
  }
  console.log(`${done} answered${DRY ? " (dry run, nothing posted)" : ""}`);
}

// Run only when called as a script: importing this file (a test, a check) must never post anything.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e.message); process.exit(1); });
