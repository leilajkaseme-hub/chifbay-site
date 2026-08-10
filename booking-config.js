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
window.CHIFBAY_STRIPE_PK = "pk_test_51U2w9pJxD5EYSiY2gXkLwjJp5wZmXkdZABuHktDre0KkePB4PMQnDyUAzG5Psr5HLWc1q05FhgUev7RMUQ3nvyGv00kMHk6p82";
