#!/usr/bin/env node
/**
 * drive-sync.mjs — pull new photos out of the Google Drive "publish" folder
 * and drop them into the photo library ig-auto already draws from.
 *
 * WHY IT WORKS THIS WAY
 * ---------------------
 * The brief was "a new photo in the Drive folder gets posted the next day".
 * The obvious build is a second poster that watches Drive and publishes. That
 * would be the wrong build: ig-auto already posts one feed carousel and one
 * story a day, and a second publisher racing it means two posts some days,
 * none on others, and two places to debug when Instagram changes something.
 *
 * So this does not post anything. It only adds files to the library. The
 * existing chain then does the rest, unchanged:
 *
 *     05:00 UTC   top-up   reads library_dirs, builds the queue
 *     10:00 UTC   post     publishes the oldest queued carousel
 *     17:00 UTC   story
 *
 * Drop a photo in Drive today, it is in the queue at 05:00 tomorrow and posted
 * at 10:00. "The next day, at a fixed hour" falls out of the schedule that is
 * already there, and every guard ig-auto has — the daily lock, the catch-up
 * runs, the heartbeat — protects it for free.
 *
 * This job is allowed to fail. Like top-up, it fills a buffer; the queue holds
 * about 12 days, so a broken sync is a problem to fix this week, not tonight.
 *
 * AUTH
 * ----
 * A Google service account, because it is the only Drive credential that never
 * expires and needs no human to re-consent. Setup is in DRIVE-PUBLISH.md; the
 * whole of it is "create the account, share the folder with its address".
 * The JWT is signed with node:crypto — no npm packages, matching the rest of
 * this folder, so there is no dependency that can break a publishing path.
 *
 * Read-only scope. This never writes to Drive and never deletes anything: the
 * folder is the user's, and a sync job that can delete photos is a sync job
 * that will one day delete photos.
 *
 * RUN
 * ---
 *   node bin/drive-sync.mjs --check     list what is new, download nothing
 *   node bin/drive-sync.mjs
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   the service account key, whole JSON
 *   DRIVE_PUBLISH_FOLDER_ID       the folder id from its URL
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripMetadata } from "../lib/strip-metadata.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IG_AUTO = path.resolve(HERE, "..");
const SITE = path.resolve(IG_AUTO, "..");

/** config.library_dirs is resolved from the SITE root, not from ig-auto, so the
 *  photos have to land in site/social-drive for the top-up to see them.
 *  bin/check-library.mjs is the thing that says so out loud — run it after any
 *  change here. It also refuses any directory outside the repo, because
 *  GitHub Actions only ever sees what is committed. */
const DEST = path.join(SITE, "social-drive");

/** State stays with ig-auto: it is this job's bookkeeping, not site content. */
const STATE = path.join(IG_AUTO, "drive-state.json");
const CHECK = process.argv.includes("--check");

/** Drive hands back its own mime types; only still images belong in the feed.
 *  A video dropped in the folder is reported and skipped rather than silently
 *  ignored, because silence is how the ig-auto outage went unnoticed for four
 *  days. */
const IMAGE_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name} — see ig-auto/DRIVE-PUBLISH.md`);
    process.exit(1);
  }
  return v;
}

// ------------------------------------------------------------------- auth
/** Service-account JWT, signed locally, swapped for an access token. This is
 *  the whole OAuth dance for a service account: no refresh token, no consent
 *  screen, nothing that expires on a 60-day clock. */
async function accessToken() {
  const key = JSON.parse(need("GOOGLE_SERVICE_ACCOUNT_JSON"));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    });

  const sig = crypto.createSign("RSA-SHA256").update(unsigned)
    .sign(key.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    // The usual cause is the folder never being shared with the service
    // account, which fails here rather than at list time. Say so.
    throw new Error(`no access token: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.access_token;
}

// ------------------------------------------------------------------- drive
/** Prove the folder is actually reachable BEFORE listing it.
 *
 *  files.list on a folder the service account cannot see does not fail — it
 *  returns an empty list, exactly like a folder with nothing in it. So a share
 *  that was never granted, or an id typed wrong, would log
 *  "0 file(s), 0 image(s), 0 new" every morning forever and look healthy.
 *  This project has already lost weeks twice to a job that failed by being
 *  quiet, so the ambiguity is removed here rather than remembered.
 *
 *  files.get on the same id DOES 404 when there is no access. */
async function checkFolder(token, folderId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}` +
    `?fields=id,name,mimeType&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } });

  if (res.status === 404 || res.status === 403) {
    throw new Error(
      `the service account cannot see folder ${folderId} (HTTP ${res.status}).\n` +
      `  Either the id is wrong, or the folder was never shared with\n` +
      `  the service account address as Viewer. See ig-auto/DRIVE-PUBLISH.md.`);
  }
  if (!res.ok) {
    throw new Error(`drive get folder ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const folder = await res.json();
  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error(
      `${folderId} is a ${folder.mimeType}, not a folder.\n` +
      `  DRIVE_PUBLISH_FOLDER_ID must be the id from the FOLDER's URL.`);
  }
  return folder;
}

async function listFolder(token, folderId) {
  const files = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime)",
      pageSize: "200",
      orderBy: "createdTime",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`drive list ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = await res.json();
    files.push(...(json.files || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return files;
}

async function download(token, file, dest) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`download ${file.name} ${res.status}`);
  }
  const raw = Buffer.from(await res.arrayBuffer());
  if (!raw.length) throw new Error(`${file.name} downloaded as 0 bytes`);

  // Strip metadata on the way in, so nothing personal ever lands in the repo.
  // This repo is public. One photo already arrived carrying GPS coordinates, a
  // name and a capture date; five carried the phone model; twenty two carried
  // AI provenance. Doing it here rather than at posting time means the clean
  // copy is what gets committed, not just what gets published.
  //
  // Lossless: metadata blocks are cut out, the compressed image is untouched,
  // and the colour profile is deliberately kept so the picture still renders
  // the way it was shot.
  const buf = stripMetadata(raw);
  if (buf.length !== raw.length) {
    console.log(`    stripped ${raw.length - buf.length} bytes of metadata`);
  }
  fs.writeFileSync(dest, buf);
  return buf.length;
}

// ------------------------------------------------------------------- state
/** Keyed on the Drive file id, not the filename. Two photos can share a name,
 *  a file can be renamed in Drive, and either would cause a re-download or a
 *  silent skip if the name were the key. */
const loadState = () =>
  fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { pulled: {} };
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + "\n");

/** A filename ig-auto can carry through to a queue id without escaping. */
function safeName(file, ext) {
  const stem = path.basename(file.name, path.extname(file.name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "photo";
  return `${stem}-${file.id.slice(0, 8)}${ext}`;
}

// -------------------------------------------------------------------- main
async function main() {
  const folderId = need("DRIVE_PUBLISH_FOLDER_ID");
  const state = loadState();
  fs.mkdirSync(DEST, { recursive: true });

  const token = await accessToken();
  const folder = await checkFolder(token, folderId);
  const files = await listFolder(token, folderId);

  const images = files.filter((f) => IMAGE_MIME[f.mimeType]);
  const others = files.filter((f) => !IMAGE_MIME[f.mimeType]);
  const fresh = images.filter((f) => !state.pulled[f.id]);

  console.log(`drive folder "${folder.name}" (${folderId}) is reachable`);
  console.log(`drive folder: ${files.length} file(s), ${images.length} image(s), ${fresh.length} new`);
  if (!files.length) {
    console.log("  the folder is genuinely empty — drop a photo in it to test the chain");
  }
  for (const f of others) console.log(`  skipped (not a still image): ${f.name} [${f.mimeType}]`);

  if (CHECK) {
    for (const f of fresh) console.log(`  would pull: ${f.name}`);
    return;
  }

  let pulled = 0;
  for (const file of fresh) {
    const name = safeName(file, IMAGE_MIME[file.mimeType]);
    const dest = path.join(DEST, name);
    try {
      const bytes = await download(token, file, dest);
      state.pulled[file.id] = {
        name, driveName: file.name, bytes,
        createdTime: file.createdTime,
        pulledAt: new Date().toISOString(),
      };
      saveState(state);           // after each file, so a crash cannot re-pull
      pulled++;
      console.log(`  pulled ${file.name} -> ../social-drive/${name} (${bytes} bytes)`);
    } catch (err) {
      // One bad file must not cost the rest of the batch.
      console.log(`  FAILED ${file.name}: ${err.message}`);
      if (fs.existsSync(dest)) fs.rmSync(dest);
    }
  }

  console.log(`pulled ${pulled} new photo(s) into social-drive/`);
  if (pulled) {
    registerLibraryDir();
    console.log("the 05:00 UTC top-up will queue them; they post the next day");
  }
}

/** Add social-drive to config.library_dirs, but only once a real photo is in
 *  it. bin/check-library.mjs treats an empty library directory as a broken
 *  library and refuses the whole run, so registering the folder up front would
 *  stop ig-auto posting from the moment this shipped until the first photo
 *  arrived — breaking a working publisher to prepare for a feature. Doing it
 *  here means the entry appears exactly when it starts being true. */
function registerLibraryDir() {
  const file = path.join(IG_AUTO, "config.json");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (cfg.library_dirs.includes("social-drive")) return;
  cfg.library_dirs.unshift("social-drive");
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log("registered social-drive in config.library_dirs (first photo)");
}

main().catch((err) => {
  console.error(`drive-sync failed: ${err.message}`);
  process.exit(1);
});
