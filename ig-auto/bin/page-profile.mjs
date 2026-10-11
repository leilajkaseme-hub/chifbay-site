#!/usr/bin/env node
// page-profile.mjs — the Facebook Page profile and its photo album, as code.
//
//   node bin/page-profile.mjs discover   print the Page categories that look right (ids)
//   node bin/page-profile.mjs show       print the profile fields the Page has now
//   node bin/page-profile.mjs apply      set the fields of page-profile.json
//   node bin/page-profile.mjs photos     upload page-photos.json (each photo once, kept out of the news feed)
//
// Theo, 11 Oct 2026: make the Facebook Page better looking, complete bio, all elements, real photos with
// very specific keywords. Uses the same System User token as Instagram (IG_ACCESS_TOKEN: pages_manage_metadata,
// pages_manage_posts). Run from GitHub (workflow ig-auto-page-profile.yml), where that token lives.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, config } from "../lib/queue.mjs";
import { GRAPH } from "../lib/publish.mjs";

const token = process.env.IG_ACCESS_TOKEN;
const page = process.env.FB_PAGE_ID || config.fb_page_id;
if (!token) { console.error("IG_ACCESS_TOKEN is not set"); process.exit(1); }

async function call(path, { method = "GET", body, tok = token } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  const init = { method, signal: AbortSignal.timeout(180_000) };
  if (method === "GET") { for (const [k, v] of Object.entries(body ?? {})) url.searchParams.set(k, v); url.searchParams.set("access_token", tok); }
  else { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify({ ...body, access_token: tok }); }
  const res = await fetch(url, init);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${path}: ${j.error?.message ?? res.status}${j.error?.error_user_msg ? ` (${j.error.error_user_msg})` : ""}`);
  return j;
}

const pageTok = (await call(`/${page}`, { body: { fields: "access_token" } })).access_token;
const P = (path, opts = {}) => call(path, { ...opts, tok: pageTok });
const mode = process.argv[2];

/** Every Facebook Page category, flattened (the endpoint returns groups with their categories inside). */
async function allCategories() {
  const r = await call("/fb_page_categories", { body: { fields: "id,name,fb_page_categories{id,name,fb_page_categories{id,name}}", limit: "250" } });
  const out = [];
  const walk = (list) => { for (const c of list ?? []) { out.push({ id: c.id, name: c.name }); walk(c.fb_page_categories?.data ?? c.fb_page_categories); } };
  walk(r.data);
  return out;
}

if (mode === "discover") {
  const cats = await allCategories().catch((e) => { console.log(`categories: ${e.message}`); return []; });
  const want = /boat|tour|sightsee|excursion|charter|sail|yacht/i;
  console.log(`categories returned: ${cats.length}`);
  for (const c of cats.filter((c) => want.test(c.name))) console.log(`category ${c.id} ${c.name}`);
}

if (mode === "show") {
  const f = ["name", "username", "about", "description", "general_info", "category_list", "emails", "phone", "website", "single_line_address", "hours", "link"];
  const out = {};
  for (const x of f) out[x] = await P(`/${page}`, { body: { fields: x } }).then((r) => r[x] ?? null).catch((e) => `ERROR ${e.message.slice(0, 80)}`);
  console.log(JSON.stringify(out, null, 1));
}

if (mode === "apply") {
  const want = JSON.parse(readFileSync(join(ROOT, "page-profile.json"), "utf8"));
  const set = {};
  for (const k of ["about", "description", "general_info", "emails", "website"]) if (want[k] != null) set[k] = want[k];
  if (want.category_names?.length) {
    const cats = await allCategories();
    const ids = want.category_names.map((n) => cats.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean);
    if (ids.length) set.category_list = ids.slice(0, 3);
    console.log(`categories: ${want.category_names.join(", ")} -> ${ids.join(", ") || "none found"}`);
  }
  // One field per call: a refused field must not hide the others.
  for (const [k, v] of Object.entries(set)) {
    try { await P(`/${page}`, { method: "POST", body: { [k]: v } }); console.log(`set ${k}: ok`); }
    catch (e) { console.log(`set ${k}: REFUSED ${e.message.slice(0, 200)}`); }
  }
}

if (mode === "photos") {
  const LEDGER = join(ROOT, "page-photos-ledger.jsonl");
  const done = existsSync(LEDGER) ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const plan = JSON.parse(readFileSync(join(ROOT, "page-photos.json"), "utf8"));
  for (const album of plan.albums) {
    let albumId = done.find((d) => d.album === album.name && d.album_id)?.album_id;
    if (!albumId) {
      const existing = await P(`/${page}/albums`, { body: { fields: "id,name", limit: "50" } }).catch(() => ({ data: [] }));
      albumId = existing.data?.find((a) => a.name === album.name)?.id;
    }
    if (!albumId) {
      albumId = (await P(`/${page}/albums`, { method: "POST", body: { name: album.name, message: album.message } })).id;
      console.log(`album created: ${album.name} (${albumId})`);
    }
    for (const ph of album.photos) {
      if (done.some((d) => d.url === ph.url && d.ok)) { console.log(`already there: ${ph.url.split("/").pop()}`); continue; }
      try {
        const r = await P(`/${albumId}/photos`, { method: "POST", body: { url: ph.url, message: ph.caption, alt_text_custom: ph.alt, no_story: true } });
        appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ok: true, album: album.name, album_id: albumId, url: ph.url, photo_id: r.id }) + "\n");
        console.log(`uploaded: ${ph.url.split("/").pop()} -> ${r.id}`);
      } catch (e) {
        appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ok: false, album: album.name, album_id: albumId, url: ph.url, error: e.message.slice(0, 200) }) + "\n");
        console.log(`FAILED: ${ph.url.split("/").pop()}: ${e.message.slice(0, 200)}`);
      }
    }
  }
}
if (!["discover", "show", "apply", "photos"].includes(mode)) { console.error("usage: node bin/page-profile.mjs discover|show|apply|photos"); process.exit(2); }
