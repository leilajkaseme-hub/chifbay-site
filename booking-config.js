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
