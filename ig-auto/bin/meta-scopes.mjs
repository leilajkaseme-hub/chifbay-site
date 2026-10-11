#!/usr/bin/env node
// meta-scopes.mjs: what can the IG_ACCESS_TOKEN do? Prints names and permission words only,
// never a token. Used to plan Facebook Page posting: it needs pages_manage_posts.
//
//   IG_ACCESS_TOKEN=... node bin/meta-scopes.mjs
import { GRAPH } from "../lib/publish.mjs";

const token = process.env.IG_ACCESS_TOKEN;
if (!token) { console.error("IG_ACCESS_TOKEN is not set"); process.exit(1); }

async function get(path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  return res.json().catch(() => ({}));
}

const perms = await get("/me/permissions");
console.log("permissions:", perms.error ? `error: ${perms.error.message}` :
  (perms.data || []).map((p) => `${p.permission}:${p.status}`).join(", ") || "(none listed)");

const pages = await get("/me/accounts", { fields: "id,name,tasks,instagram_business_account{id,username}" });
if (pages.error) { console.log("pages: error:", pages.error.message); process.exit(0); }
for (const p of pages.data || []) {
  console.log(`page: ${p.name} id=${p.id} tasks=${(p.tasks || []).join("|")} instagram=${p.instagram_business_account?.username || "none"}`);
}
if (!(pages.data || []).length) console.log("pages: none visible");
