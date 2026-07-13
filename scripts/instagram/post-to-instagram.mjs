/**
 * Chifbay — publish ONE photo to Instagram via the official Instagram Graph API.
 *
 * This is Meta's sanctioned, FREE, ToS-compliant way to post. It does NOT use
 * your Instagram password and cannot get the account banned (unlike private-API
 * "auto-poster" bots). Runs from GitHub Actions on a schedule — computer can be OFF.
 *
 * Requires env:
 *   IG_USER_ID       — your Instagram Business/Creator account id (a number)
 *   IG_ACCESS_TOKEN  — a long-lived access token with instagram_content_publish
 * Optional env:
 *   GRAPH_VERSION    — Graph API version (default v21.0)
 *
 * Usage:
 *   node post-to-instagram.mjs --image-url <https url> --caption-file <path>
 *   node post-to-instagram.mjs --image-url <https url> --caption "text"
 *
 * The image URL must be a public https JPEG (your social/ pool already is:
 * https://chifbay.com/social/chifbay-NN.jpg).
 */
import fs from "node:fs";

const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || "v21.0"}`;
const IG_USER_ID = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;

function fail(msg) { console.error("ERROR:", msg); process.exit(1); }

if (!IG_USER_ID) fail("Missing IG_USER_ID (set it as a GitHub Actions secret).");
if (!TOKEN) fail("Missing IG_ACCESS_TOKEN (set it as a GitHub Actions secret).");

// ---- parse args -------------------------------------------------------------
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const imageUrl = arg("--image-url");
let caption = arg("--caption");
const captionFile = arg("--caption-file");
if (captionFile) caption = fs.readFileSync(captionFile, "utf8");
if (!imageUrl) fail("Missing --image-url");
if (!caption || !caption.trim()) fail("Missing --caption / --caption-file");
caption = caption.trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json.error || {};
    fail(`Graph API ${res.status}: ${e.message || JSON.stringify(json)}` +
         (e.error_user_msg ? ` — ${e.error_user_msg}` : ""));
  }
  return json;
}

async function containerStatus(id) {
  const body = new URLSearchParams({ fields: "status_code,status", access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${id}?${body}`);
  return res.json().catch(() => ({}));
}

(async () => {
  console.log(`Posting to IG user ${IG_USER_ID}`);
  console.log(`Image:   ${imageUrl}`);
  console.log(`Caption: ${caption.slice(0, 80).replace(/\n/g, " ")}${caption.length > 80 ? "…" : ""}`);

  // 1) Create the media container.
  const created = await api(`${IG_USER_ID}/media`, { image_url: imageUrl, caption });
  const creationId = created.id;
  if (!creationId) fail("No creation id returned from /media.");
  console.log(`Container created: ${creationId}`);

  // 2) Wait until the container is FINISHED (images are usually instant; poll to be safe).
  for (let i = 0; i < 12; i++) {
    const s = await containerStatus(creationId);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") fail(`Container processing failed: ${s.status || "ERROR"}`);
    if (i === 11) fail("Container did not become FINISHED in time.");
    await sleep(5000);
  }

  // 3) Publish it.
  const published = await api(`${IG_USER_ID}/media_publish`, { creation_id: creationId });
  console.log(`PUBLISHED: https://instagram.com — media id ${published.id}`);
})();
