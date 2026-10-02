// node --test test-reviews.mjs : the review clean-up rules, on fixtures and on the live dataset
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAndDedupe } from "./build-reviews.mjs";

const r = (o) => ({ source: "getyourguide", tourId: "t1", author: "Anna", country: "France", date: "2026-07-21", rating: 5, ...o });
const quiet = () => {};

test("owner reply is never kept as the guest's text", () => {
  const out = cleanAndDedupe([{ id: "g1", source: "google", author: "Dominic", date: "2026-08-12", text: "Response from the owner 3 days ago Thank you so much" }], quiet);
  assert.equal(out.length, 0);
});
test("icon glyphs are stripped", () => {
  const out = cleanAndDedupe([{ id: "g2", source: "google", author: "Kyle", date: "2026-08-01", text: "Brand new boat " }], quiet);
  assert.equal(out[0].text, "Brand new boat");
});
test("Google trip details are not guest text", () => {
  const a = cleanAndDedupe([{ id: "g3", source: "google", author: "J", date: "2026-09-01", text: "Tour duration 2–3 hr" }], quiet);
  assert.equal(a.length, 0);
  const b = cleanAndDedupe([{ id: "g4", source: "google", author: "C", date: "2026-09-01", text: "Amazing! Highly recommended. … Tour duration 2–3 hr" }], quiet);
  assert.equal(b[0].text, "Amazing! Highly recommended.");
});
test("GetYourGuide original + English version become one review with a translation", () => {
  const out = cleanAndDedupe([r({ id: "a", text: "Une expérience absolument magique, tout était parfait" }), r({ id: "b", text: "An absolutely magical experience, everything was perfect and we loved the boat" })], quiet);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
  assert.match(out[0].translation, /magical/);
});
test("near identical text on the same day is one review, the fuller one kept", () => {
  const out = cleanAndDedupe([r({ source: "tripadvisor", id: "x", author: "S R", text: "Absolutely Worth It. Couldn't have asked for a better experience" }), r({ source: "tripadvisor", id: "y", author: "S R", text: "Absolutely Worth It Couldn't have asked for a better experience." })], quiet);
  assert.equal(out.length, 1);
});
test("two different guests sharing a first name stay two reviews", () => {
  const out = cleanAndDedupe([r({ id: "p", text: "Great trip with the family, swimming was lovely" }), r({ id: "q", text: "Wonderful sunset, the skippers were so kind and the wine was good" })], quiet);
  assert.equal(out.length, 2);
});
test("same name on different dates is never merged", () => {
  const out = cleanAndDedupe([r({ id: "m", text: "Great trip" }), r({ id: "n", date: "2026-07-22", text: "Great trip" })], quiet);
  assert.equal(out.length, 2);
});
test("the live dataset has no owner reply as text and no duplicate ids after clean-up", () => {
  const live = JSON.parse(readFileSync(new URL("../../reviews.json", import.meta.url), "utf8")).reviews;
  const out = cleanAndDedupe(live, quiet);
  assert.ok(out.every((x) => !/^Response from the owner/i.test(x.text)));
  assert.equal(new Set(out.map((x) => x.id)).size, out.length);
  assert.ok(out.every((x) => !/[-]/.test(x.text)));
});
