// lib.mjs: the Google Business Profile API for Chifbay's main profile ("Chifbay, Marina do Funchal").
//
// Access was granted on the Cloud project chifbay-gbp (898903592802) in October 2026. Google refuses service
// accounts here: it wants OAuth as the profile owner (chifandcopt@gmail.com) and a stored refresh token.
//   GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN   (GitHub secrets; local copy .credentials/chifbay-gbp-oauth.json)
// Zero npm packages: Node's fetch only.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const LEDGER = join(ROOT, "ledger.jsonl");
// The main profile, the one that holds the reviews (the other 3 are duplicates Theo chose to keep untouched).
export const MAIN_LOCATION = "11229657632154885978";
const V4 = "https://mybusiness.googleapis.com/v4";

export function creds(env = process.env) {
  if (env.GBP_REFRESH_TOKEN) return { id: env.GBP_CLIENT_ID, secret: env.GBP_CLIENT_SECRET, refresh: env.GBP_REFRESH_TOKEN };
  const f = "/Users/Shared/Claude/.credentials/chifbay-gbp-oauth.json";
  if (existsSync(f)) { const j = JSON.parse(readFileSync(f, "utf8")); return { id: j.client_id, secret: j.client_secret, refresh: j.refresh_token }; }
  throw new Error("Google Business Profile is not connected (GBP_REFRESH_TOKEN missing)");
}

let cached = null;
export async function token() {
  if (cached && Date.now() < cached.exp) return cached.value;
  const c = creds();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: c.refresh, grant_type: "refresh_token" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`Google refused the token: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  cached = { value: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return cached.value;
}

export async function api(method, url, body) {
  const r = await fetch(url, {
    method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120_000),
  });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text.slice(0, 300) }; }
  if (!r.ok) throw new Error(`${method} ${url.replace(/https:\/\/[^/]+/, "")} ${r.status}: ${j.error?.message ?? text.slice(0, 200)}`);
  return j;
}

/** accounts/{a}/locations/{l} of the main profile. */
export async function where() {
  const acc = await api("GET", "https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
  for (const a of acc.accounts ?? []) {
    const locs = await api("GET", `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storeCode&pageSize=100`);
    for (const l of locs.locations ?? []) {
      if (l.name.endsWith(`/${MAIN_LOCATION}`) || l.storeCode === MAIN_LOCATION) {
        return { account: a.name, location: l.name, path: `${a.name}/${l.name}`, title: l.title };
      }
    }
  }
  throw new Error(`the main profile ${MAIN_LOCATION} is not in this account's locations`);
}

export const v4 = (p) => `${V4}/${p}`;

export function ledger() {
  return existsSync(LEDGER) ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
}
export const record = (e) => appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");

export async function ntfy(title, message) {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, "..", "ig-auto", "config.json"), "utf8"));
    await fetch(cfg.ntfy.inbox, { method: "POST", headers: { Title: title.replace(/[^\x20-\x7e]/g, "") }, body: message });
  } catch { /* an alert must never stop the job */ }
}
