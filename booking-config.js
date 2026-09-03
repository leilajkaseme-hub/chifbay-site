/* The two public settings for the booking page.
 *
 * Both values here are safe to publish. A Stripe PUBLISHABLE key (pk_test_… or
 * pk_live_…) is meant to be read by anyone — it can only start a payment, not
 * move money or read your account. The SECRET key (sk_…) must never appear in
 * this repo, which is public. It lives only in the Cloudflare Worker.
 *
 * Currently on TEST keys. To go live: put the pk_live_… key below and set the
 * matching sk_live_… in Cloudflare. Nothing else moves.
 */
window.CHIFBAY_API = "https://chifbay-booking-api.chifandcopt.workers.dev";
window.CHIFBAY_STRIPE_PK = "pk_live_51U2w9pJxD5EYSiY2dfmzIX2AUaly4adM9TXYnLZPcbXTWe2HL5SjtpMC0SfpfUpPVEuwUox5HpuvnwCtOxjG7jfn00XBM3uQi2";

/* Days the boat is not taking bookings, on top of whatever the calendar
 * already says. One rule per line, dates inclusive, YYYY-MM-DD.
 *
 *   trips: "all"          -> nothing runs that day
 *   trips: ["day-trip"]   -> only the day trip is closed, the sunset still runs
 *   trips: ["sunset"]     -> only the sunset is closed
 *
 * Trip ids are the ones the Worker publishes at /v1/catalogue: "day-trip" and
 * "sunset". A rule naming anything else is ignored, silently, so a typo closes
 * nothing rather than closing everything.
 *
 * IMPORTANT — this only closes the calendar on this website. The booking API
 * and the Google Calendar behind it do not know about it, and neither do
 * GetYourGuide or Viator. Block there as well, or those channels will keep
 * selling the same days.
 *
 * Delete a rule once the dates have passed; nothing cleans up on its own.
 */
window.CHIFBAY_CLOSED = [
  { from: "2026-09-06", to: "2026-09-17", trips: "all" },
  // The 18th: the day trip is off, the sunset still goes out.
  { from: "2026-09-18", to: "2026-09-18", trips: ["day-trip"] },
  // The 19th: the sunset is off, the day trip is fine.
  { from: "2026-09-19", to: "2026-09-19", trips: ["sunset"] }
];
