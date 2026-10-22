#!/usr/bin/env node
// followers-report.mjs: send @chifbay's follower counts to the stores dashboard
// (page "Social media", https://dashboard-pink-nine-58.vercel.app/social).
// Read only on Meta: it never posts, follows or edits anything. Node stdlib only.
//
//   IG_ACCESS_TOKEN=... DASHBOARD_OPS_SECRET=... [IG_SYNC_SECRET=... THREADS_ACCESS_TOKEN=...] \
//   [FOLLOW_DAYS=3] node bin/followers-report.mjs
//
// Instagram: followers now, plus follows and unfollows per day for the last FOLLOW_DAYS full
// days (UTC). The dashboard rebuilds the days before its first reading from them, so one run
// with FOLLOW_DAYS=150 fills the history since June. Facebook Page and Threads: followers now.
// A source that fails is sent as an error, never as 0 (0 would read as "nobody follows").
// Runs in GitHub Actions (social-followers.yml) because these tokens only exist as secrets here.
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
const GRAPH = "https://graph.facebook.com/v21.0";
const THREADS = "https://graph.threads.net/v1.0";
const DASHBOARD = (process.env.SOCIAL_DASHBOARD_URL || "https://dashboard-pink-nine-58.vercel.app").replace(/\/+$/, "");
const token = process.env.IG_ACCESS_TOKEN;
const igUser = process.env.IG_USER_ID || config.ig_user_id;
const page = process.env.FB_PAGE_ID || config.fb_page_id;
const secret = process.env.DASHBOARD_OPS_SECRET;
const days = Math.min(400, Math.max(1, Number(process.env.FOLLOW_DAYS) || 3));

if (!token || !secret) {
  console.error("IG_ACCESS_TOKEN and DASHBOARD_OPS_SECRET must both be set");
  process.exit(1);
}

const hide = (s) => String(s).replace(/access_token=[^&\s"]+/g, "access_token=…").slice(0, 200);

async function get(base, path, params) {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(hide(`${json.error?.message ?? `HTTP ${res.status}`}${json.error?.code != null ? ` (code ${json.error.code})` : ""}`));
  return json;
}

const count = (v, what) => {
  const n = v === null || v === undefined || v === "" ? NaN : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`no ${what} in the answer`);
  return n;
};

async function instagram() {
  const me = await get(GRAPH, `/${igUser}`, { fields: "username,followers_count", access_token: token });
  const followers = count(me.followers_count, "follower count");
  // Windows start at 00:00 UTC: at other hours Instagram counts the boundary day twice.
  const deltas = {};
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  for (let i = 1; i <= days; i++) {
    const since = (today - i * 86_400_000) / 1000;
    const day = new Date(since * 1000).toISOString().slice(0, 10);
    try {
      const r = await get(GRAPH, `/${igUser}/insights`, {
        metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type",
        since, until: since + 86_400, access_token: token,
      });
      const res = r.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const v = (k) => Number(res.find((x) => x.dimension_values?.[0] === k)?.value) || 0;
      deltas[day] = [v("FOLLOWER"), v("NON_FOLLOWER")];
    } catch (e) {
      console.warn(`instagram ${day}: ${e.message}`);   // that day stays unknown, never 0
    }
  }
  return { id: "chifbay-ig", followers, deltas };
}

async function facebook() {
  const p = await get(GRAPH, `/${page}`, { fields: "access_token", access_token: token });
  if (!p.access_token) throw new Error("no Page access token: the token needs a role on the Page");
  const r = await get(GRAPH, `/${page}`, { fields: "followers_count,fan_count", access_token: p.access_token });
  return { id: "chifbay-fb", followers: count(r.followers_count ?? r.fan_count, "follower count") };
}

// The live Threads token is kept by the booking Worker (crosspost renews it there); the
// secret is the seed. Read only here: renewing stays the crosspost's job.
async function threads() {
  const tries = [];
  if (process.env.IG_SYNC_SECRET && config.approvals_url) {
    const url = config.approvals_url.replace(/\/v1\/ig\/approvals$/, "/v1/ig/threads-token");
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.IG_SYNC_SECRET}` }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    const v = r?.ok ? await r.json().catch(() => null) : null;
    if (v?.token) tries.push(v.token);
  }
  if (process.env.THREADS_ACCESS_TOKEN) tries.push(process.env.THREADS_ACCESS_TOKEN);
  if (!tries.length) throw new Error("no Threads token (THREADS_ACCESS_TOKEN / Worker copy)");
  let last;
  for (const t of tries) {
    try {
      const r = await get(THREADS, "/me/threads_insights", { metric: "followers_count", access_token: t });
      return { id: "chifbay-th", followers: count(r.data?.find((x) => x.name === "followers_count")?.total_value?.value, "follower count") };
    } catch (e) { last = e; }
  }
  throw last;
}

const sources = [["chifbay-ig", instagram], ["chifbay-fb", facebook], ["chifbay-th", threads]];
const accounts = [];
for (const [id, fn] of sources) {
  try {
    const a = await fn();
    accounts.push({ ...a, at: new Date().toISOString() });
    console.log(`${id}: ${a.followers} followers${a.deltas ? `, ${Object.keys(a.deltas).length} days of follows` : ""}`);
  } catch (e) {
    accounts.push({ id, error: hide(e.message) });
    console.warn(`${id}: ${hide(e.message)}`);
  }
}

const res = await fetch(`${DASHBOARD}/api/social`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify({ source: "GitHub Actions social-followers.yml", accounts }),
  signal: AbortSignal.timeout(60_000),
});
const answer = await res.json().catch(() => ({}));
if (!res.ok || !answer.ok) {
  console.error(`dashboard answered ${res.status}: ${JSON.stringify(answer).slice(0, 300)}`);
  process.exit(1);
}
console.log(`dashboard saved: ${answer.saved.join(", ")}${answer.refused?.length ? `; refused: ${JSON.stringify(answer.refused)}` : ""}`);
