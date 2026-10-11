#!/usr/bin/env node
// threads-token.mjs — put the Threads token in the GitHub secret, after checking it is the right one.
//
//   node bin/threads-token.mjs <token>
//
// The token comes from the Meta app (Chifbay) > Threads use case > Settings > "Générer un token
// d'accès" for the chifbay tester. It is checked against Threads (must belong to @chifbay), then
// stored as the GitHub secret THREADS_ACCESS_TOKEN of the site repo. It is never printed.
// The robot stores and renews it by itself from there (lib/crosspost.mjs, threadsAuth).
import { spawnSync } from "node:child_process";

const token = (process.argv[2] ?? "").trim();
if (token.length < 50) { console.error("usage: node bin/threads-token.mjs <token>"); process.exit(2); }

const res = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(30_000) });
const me = await res.json().catch(() => ({}));
if (!res.ok || !me.id) { console.error(`Threads refused this token: ${me.error?.message ?? res.status}`); process.exit(1); }
if (me.username !== "chifbay") { console.error(`This token is for @${me.username}, not @chifbay. Nothing stored.`); process.exit(1); }

const set = spawnSync("gh", ["secret", "set", "THREADS_ACCESS_TOKEN", "--repo", "leilajkaseme-hub/chifbay-site"], { input: token, encoding: "utf8" });
if (set.status !== 0) { console.error(`gh could not store the secret: ${set.stderr.trim()}`); process.exit(1); }
console.log(`OK: token for @${me.username} (Threads id ${me.id}) stored as THREADS_ACCESS_TOKEN. The next post goes to Threads too.`);
