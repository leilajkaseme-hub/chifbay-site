#!/usr/bin/env node
// token-check.mjs — the watchdog for the one credential this whole thing rests on.
//
// A System User token issued with no expiry never needs refreshing, which is
// exactly why nobody would notice if the wrong kind of token got pasted in.
// This runs weekly and shouts long before anything breaks:
//
//   - token invalid or revoked                -> alert now
//   - token has an expiry date at all         -> alert, it is the wrong kind
//   - expiry closer than 14 days              -> alert loudly
//   - a required permission is missing        -> alert
//   - the account id does not resolve         -> alert
//
// Silence from this job means the credential is genuinely fine.
import { GRAPH } from "../lib/publish.mjs";
import { config } from "../lib/queue.mjs";
import { alert } from "../lib/notify.mjs";

const REQUIRED = ["instagram_basic", "instagram_content_publish"];
const DAY = 86_400_000;

const token = process.env.IG_ACCESS_TOKEN;
const user = process.env.IG_USER_ID || config.ig_user_id;
if (!token || !user) {
  console.error("IG_ACCESS_TOKEN secret / ig_user_id in config.json are not both set");
  process.exit(1);
}

async function get(path, params) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(json.error.message ?? `HTTP ${res.status}`);
  return json;
}

const problems = [];

const { data } = await get("/debug_token", { input_token: token, access_token: token });
if (!data?.is_valid) problems.push("the token is not valid any more");

// expires_at 0 means "never" — that is the shape we want.
const expiresAt = Number(data?.expires_at ?? 0);
if (expiresAt > 0) {
  const days = Math.round((expiresAt * 1000 - Date.now()) / DAY);
  if (days <= 14) {
    problems.push(`the token expires in ${days} day(s)`);
  } else {
    problems.push(
      `the token expires in ${days} days — a System User token with no expiry avoids this entirely`,
    );
  }
}

const scopes = data?.scopes ?? [];
const missing = REQUIRED.filter((s) => !scopes.includes(s));
if (missing.length) problems.push(`missing permission(s): ${missing.join(", ")}`);

let username = null;
try {
  ({ username } = await get(`/${user}`, { fields: "username", access_token: token }));
} catch (err) {
  problems.push(`IG_USER_ID does not resolve: ${err.message}`);
}

console.log(`account     ${username ? `@${username}` : user}`);
console.log(`valid       ${data?.is_valid ? "yes" : "NO"}`);
console.log(`expires     ${expiresAt === 0 ? "never" : new Date(expiresAt * 1000).toISOString()}`);
console.log(`scopes      ${scopes.join(", ") || "(none)"}`);

if (problems.length) {
  console.error("\nPROBLEMS:");
  for (const p of problems) console.error(`  - ${p}`);
  await alert(
    "CHIFBAY Instagram token needs attention",
    problems.join("\n") + "\n\nPosting will stop when it expires. See ig-auto/README.md.",
  );
  process.exit(1);
}

console.log("\nall good");
