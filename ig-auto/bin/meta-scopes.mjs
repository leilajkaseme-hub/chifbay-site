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

// ---- profile words and the location tag (read-only; a container that is never published expires) ----
const igUser = process.env.IG_USER_ID;
if (igUser) {
  const ig = await get(`/${igUser}`, { fields: "username,name,biography,website" });
  console.log("instagram profile:", ig.error ? `error: ${ig.error.message}` : JSON.stringify({ name: ig.name, bio: ig.biography, website: ig.website }));
}
const pg = (pages.data || [])[0];
if (pg) {
  const info = await get(`/${pg.id}`, { fields: "about,description,category,location,website,link,fan_count" });
  console.log("facebook page:", info.error ? `error: ${info.error.message}` : JSON.stringify(info));
  const found = await get("/search", { type: "place", q: "Funchal", fields: "id,name,location", limit: "5" });
  console.log("place search:", found.error ? `error: ${found.error.message}` : JSON.stringify((found.data || []).map((x) => ({ id: x.id, name: x.name, city: x.location?.city }))));
  if (igUser && process.env.PROBE_IMAGE) {
    const probe = async (label, id) => {
      const url = new URL(`${GRAPH}/${igUser}/media`);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: process.env.PROBE_IMAGE, location_id: id, access_token: token }) });
      const j = await res.json().catch(() => ({}));
      console.log(`location probe (${label} ${id}):`, j.error ? `refused: ${j.error.message}` : "accepted");
    };
    await probe("own page", pg.id);
    for (const p of (found.data || []).slice(0, 3)) await probe(p.name, p.id);
  }
}
