#!/usr/bin/env node
// insights.mjs: read how @chifbay is doing. Read only, it never posts or edits.
//
//   IG_ACCESS_TOKEN=... node bin/insights.mjs > insights.json
//
// Writes one JSON document: the account, its last 28 days, who follows it, when
// they are online, and every recent post with its own numbers. A metric the API
// refuses is written as null with the reason, never as 0: a 0 would read as
// "nobody saw it", which is a different fact.
import { GRAPH } from "../lib/publish.mjs";
import { config } from "../lib/queue.mjs";

const token = process.env.IG_ACCESS_TOKEN;
const user = process.env.IG_USER_ID || config.ig_user_id;
if (!token || !user) {
  console.error("IG_ACCESS_TOKEN secret / ig_user_id in config.json are not both set");
  process.exit(1);
}
const MEDIA_LIMIT = Number(process.env.MEDIA_LIMIT || 60);

async function get(path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const json = await res.json().catch(() => ({}));
  if (json.error) {
    const e = json.error;
    throw new Error(`${e.message} (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""})`);
  }
  return json;
}

// One call per metric: a single refused metric must not hide the others.
async function metric(path, name, params) {
  try {
    const { data } = await get(path, { metric: name, ...params });
    return { name, data: data?.[0] ?? null };
  } catch (e) {
    return { name, error: e.message.slice(0, 200) };
  }
}

const now = Math.floor(Date.now() / 1000);
const since = now - 28 * 86_400;
const out = { collected_at: new Date().toISOString(), graph: GRAPH };

out.account = await get(`/${user}`, {
  fields: "username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url",
});

// Account totals over 28 days.
out.last_28_days = {};
for (const m of ["reach", "views", "profile_views", "accounts_engaged", "total_interactions",
  "likes", "comments", "shares", "saves", "follows_and_unfollows", "website_clicks", "profile_links_taps"]) {
  const r = await metric(`/${user}/insights`, m, { period: "day", metric_type: "total_value", since, until: now });
  out.last_28_days[m] = r.error ? { error: r.error } : r.data?.total_value ?? null;
}
// Reach split by followers / non followers, and by surface (feed, reels, explore...).
for (const b of ["follow_type", "media_product_type"]) {
  const r = await metric(`/${user}/insights`, "reach", { period: "day", metric_type: "total_value", since, until: now, breakdown: b });
  out.last_28_days[`reach_by_${b}`] = r.error ? { error: r.error } : r.data?.total_value ?? null;
}
// Daily reach curve.
{
  const r = await metric(`/${user}/insights`, "reach", { period: "day", since, until: now });
  out.reach_daily = r.error ? { error: r.error } : r.data?.values ?? null;
}

// Who follows: country, city, age, gender.
out.followers = {};
for (const b of ["country", "city", "age", "gender"]) {
  const r = await metric(`/${user}/insights`, "follower_demographics", {
    period: "lifetime", metric_type: "total_value", timeframe: "this_month", breakdown: b,
  });
  out.followers[b] = r.error ? { error: r.error } : r.data?.total_value ?? null;
}
{
  const r = await metric(`/${user}/insights`, "online_followers", { period: "lifetime", since: now - 2 * 86_400, until: now });
  out.online_followers = r.error ? { error: r.error } : r.data?.values ?? null;
}

// Every recent post with its own numbers.
const FEED_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions", "follows", "profile_visits"];
const REEL_METRICS = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions",
  "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"];
out.media = [];
let next = `/${user}/media`;
let params = {
  fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,thumbnail_url,media_url",
  limit: 50,
};
while (next && out.media.length < MEDIA_LIMIT) {
  const page = await get(next, params);
  for (const m of page.data ?? []) {
    if (out.media.length >= MEDIA_LIMIT) break;
    const names = m.media_product_type === "REELS" ? REEL_METRICS : FEED_METRICS;
    m.insights = {};
    for (const n of names) {
      const r = await metric(`/${m.id}/insights`, n, {});
      m.insights[n] = r.error ? null : r.data?.values?.[0]?.value ?? r.data?.total_value?.value ?? null;
      if (r.error) (m.insights_errors ??= {})[n] = r.error;
    }
    out.media.push(m);
  }
  const after = page.paging?.cursors?.after;
  next = page.paging?.next && after ? `/${user}/media` : null;
  params = { ...params, after };
}

// Stories live 24 h; whatever is up right now.
try {
  out.stories_live = (await get(`/${user}/stories`, { fields: "id,media_type,timestamp,permalink" })).data ?? [];
} catch (e) {
  out.stories_live = { error: e.message };
}

process.stdout.write(JSON.stringify(out, null, 1) + "\n");
console.error(`@${out.account.username}: ${out.account.followers_count} followers, ${out.media.length} posts read`);
